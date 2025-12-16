// src/components/Mainpage/Mainpage.jsx
import "./Mainpage.css";
import Topbar from "../Topbar/Topbar";
import Sidebar from "../Sidebar/Sidebar";
import SidebarRight from "../SidebarRight/SidebarRight";
import Globe from "../Viewer/Viewer";
import MyObjects from "../MyObjects/MyObjects";

import { useRef, useCallback, useState, useEffect } from "react";
import { zoomToNextScaleStep } from "../../modules/zoom-to-scale";
import { zoomTo } from "../../modules/utils";
import { exportMainViewportToPdf } from "../../modules/export-pdf";
import { downloadBlobCrossBrowser } from "../../modules/download-helpers";
import * as Cesium from "cesium";

// Modals
import TextModal from "../TextModal/TextModal";
import LinesModal from "../LinesModal/LinesModal";
import AreaModal from "../AreaModal/AreaModal";
import MarkerModal from "../MarkerModal/MarkerModal";
import ActiveToolModal from "../ActiveToolModal/ActiveToolModal";

// Draft helpers (apply + draftFrom)
import {
  draftFromEntityLabel,
  applyDraftToEntityLabel,
} from "../Tools/AddText/labelDraft";
import {
  draftFromLineEntity,
  applyDraftToLineEntity,
  setLineLabelsVisibility,
  pointGraphicsFromDraft,
  rebuildSegmentLabels,
  upsertTotalLengthLabel,
} from "../Tools/DrawLines/linesDraft";
import {
  draftFromAreaEntity,
  applyDraftToAreaEntity,
  rebuildAreaEdgeLabels,
  rebuildAreaLabel,
} from "../Tools/DrawArea/areaDraft";
import {
  draftFromMarkerEntity,
  applyDraftToMarkerEntity,
} from "../Tools/AddMarker/markersDraft";
import {
  startAreaEdit,
  startLineEdit,
  stopEdit,
} from "../Tools/EditJunctions/editGeometry";

export default function Mainpage({
  pickedAddress,
  setPickedAddress,
  isMobile,
  setIsMobile,
}) {
  const [lon, lat] = pickedAddress.geometry.coordinates;

  const viewerRef = useRef(null);
  const entitiesRef = useRef(new Map());

  // Active in-map edit sessions (drag junctions)
  const editSessionsRef = useRef(new Map());

  // Snapshot of positions during MoveTool session
  const moveSnapshotRef = useRef(null);

  const [activeTool, setActiveTool] = useState("no-tool");

  // >>> Core fix: uiTick forces SidebarRight (and MyObjects) to re-render on any change
  const [uiTick, setUiTick] = useState(0);
  const entitiesUpdateUI = useCallback(() => setUiTick((t) => t + 1), []);

  // Register entities created by tools
  const setEntitiesRef = useCallback(
    (uuid, entity) => {
      entitiesRef.current.set(uuid, entity);
      entitiesUpdateUI();
    },
    [entitiesUpdateUI]
  );

  const [isUserShowMenu, setIsUserShowMenu] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 992);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // --- Snapshot all entity positions when MoveTool is activated ---
  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    if (activeTool === "move-object") {
      const snap = new Map();
      const time = v.clock.currentTime;

      for (const [uuid, ent] of entitiesRef.current.entries()) {
        if (!ent) continue;

        if (ent.polyline) {
          const positions = snapshotPolylinePositions(ent, v);
          snap.set(uuid, { kind: "line", positions });
        } else if (ent.polygon) {
          const positions = snapshotPolygonPositions(ent, v);
          snap.set(uuid, { kind: "area", positions });
        } else if (
          (ent.point || ent.billboard || ent.label) &&
          !ent.polyline &&
          !ent.polygon
        ) {
          const pos = readPosition(ent, time);
          if (pos) snap.set(uuid, { kind: "point", position: pos });
        }
      }

      moveSnapshotRef.current = snap;
    }
  }, [activeTool]);

  // Fly to new picked address on change
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !pickedAddress?.geometry?.coordinates) return;
    const [lo, la] = pickedAddress.geometry.coordinates;
    zoomTo(v, lo, la);
    zoomToNextScaleStep(v, +1, 140);
  }, [pickedAddress]);

  // Show/hide (soft delete / restore)
  const updateShowHideEntitiesRef = useCallback(
    (uuid, visible) => {
      const ent = entitiesRef.current.get(uuid);
      if (!ent) return;

      const ch = ent.__children || {};
      const draft = ent.__draft || {};
      const v = !!visible;

      const toggleArray = (arr, show) => {
        if (Array.isArray(arr))
          for (const child of arr) if (child) child.show = show;
      };
      const toggleOne = (child, show) => {
        if (child) child.show = show;
      };

      switch (ent.type) {
        case "Linje": {
          ent.show = v;
          toggleArray(ch.points, v);
          toggleArray(ch.labels, v && !!draft.showValues);
          toggleOne(
            ch.totalLabel,
            v && (draft.showTotal ?? draft.showValues ?? true)
          );
          break;
        }
        case "Area": {
          ent.show = v;
          toggleOne(ch.label, v && !!draft.showAreaLabel);
          toggleArray(ch.edgeLabels, v && !!draft.showEdgeValues);
          toggleArray(ch.points, v && !!draft.showPoints);
          break;
        }
        case "Punkt": {
          ent.show = v;
          break;
        }
        case "Text": {
          ent.show = v;
          break;
        }
        default: {
          toggleArray(ch.points, v);
          toggleArray(ch.labels, v);
          toggleArray(ch.edgeLabels, v);
          toggleOne(ch.totalLabel, v);
          toggleOne(ch.label, v);
          ent.show = v;
        }
      }

      ent.isActive = v;
      ent.lastUpdated = new Date().toISOString();
      entitiesUpdateUI?.();
    },
    [entitiesUpdateUI]
  );

  // Hard-delete all inactive
  const removeAllInactiveEntitiesRef = useCallback(() => {
    const v = viewerRef.current;
    if (!v) return;

    const safeRemove = (e) => {
      try {
        if (e && v.entities.contains(e)) v.entities.remove(e);
      } catch {}
    };

    for (const [uuid, ent] of entitiesRef.current.entries()) {
      if (!ent.isActive) {
        const ch = ent.__children || {};
        const arrays = [ch.points, ch.segmentLabels, ch.edgeLabels, ch.labels];
        arrays.forEach((arr) => {
          if (Array.isArray(arr)) arr.forEach((c) => safeRemove(c));
        });
        if (ch.label) safeRemove(ch.label);
        if (ch.totalLabel) safeRemove(ch.totalLabel);
        if (ch.temp?.label) safeRemove(ch.temp.label);
        if (ch.temp?.poly) safeRemove(ch.temp.poly);
        if (ch.temp?.line) safeRemove(ch.temp.line);

        safeRemove(ent);
        entitiesRef.current.delete(uuid);
      }
    }
    entitiesUpdateUI();
  }, [entitiesUpdateUI]);

  const handleReady = useCallback((viewer) => {
    viewerRef.current = viewer;
    zoomIn();
  }, []);

  const handleDownloadMap = useCallback(async () => {
    const v = viewerRef.current;
    const mainEl = document.querySelector("main.main");
    if (!v || !mainEl) return;

    await exportMainViewportToPdf(v, mainEl, {
      filename: "min-karta.pdf",
      resolutionScale: Math.max(2, Math.floor(window.devicePixelRatio || 2)),
      margin: 2,
      headerText: `${pickedAddress.properties.ADRESS} / ${pickedAddress.properties.FASTIGHET}`,
    });
  }, []);

  // ---- GEOJSON EXPORT -------------------------------------------------------
  function cartesianToLonLat(cart, ellipsoid) {
    const c = Cesium.Cartographic.fromCartesian(cart, ellipsoid);
    return [
      Cesium.Math.toDegrees(c.longitude),
      Cesium.Math.toDegrees(c.latitude),
    ];
  }

  function readPolylinePositions(ent, time) {
    const p = ent?.polyline?.positions;
    return Array.isArray(p) ? p : p?.getValue?.(time) ?? [];
  }

  function readPolygonPositions(ent, time) {
    const h = ent?.polygon?.hierarchy;
    const val = h?.getValue ? h.getValue(time) : h;
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (val.positions) return val.positions;
    return [];
  }

  function readPosition(ent, time) {
    const p = ent?.position;
    return p?.getValue ? p.getValue(time) : p;
    // returns Cartesian3 or undefined
  }

  const handleDownloadGeoJSON = useCallback(() => {
    const v = viewerRef.current;
    if (!v) return;

    const time = v.clock.currentTime;
    const ellipsoid = v.scene.globe.ellipsoid;

    const features = [];

    for (const [uuid, ent] of entitiesRef.current.entries()) {
      // Only export active/visible items
      if (!ent?.isActive || ent.show === false) continue;

      // Normalize a type for properties
      const typeGuess =
        ent.type ??
        (ent.polyline
          ? "Linje"
          : ent.polygon
          ? "Area"
          : ent.label
          ? "Text"
          : "Punkt");

      // Punkt or Text → Point
      if (
        (ent.point || ent.billboard || ent.label) &&
        !ent.polyline &&
        !ent.polygon
      ) {
        const pos = readPosition(ent, time);
        if (!pos) continue;
        const [lon, lat] = cartesianToLonLat(pos, ellipsoid);

        const props = {
          id: uuid,
          type: typeGuess,
        };
        if (ent.label?.text)
          props.text = ent.label.text?.getValue?.(time) ?? ent.label.text;
        if (ent.__draft?.iconId) props.iconId = ent.__draft.iconId;

        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: props,
        });
      }
      // Linje → LineString
      else if (ent.polyline) {
        const arr = readPolylinePositions(ent, time);
        if (!arr?.length) continue;
        const coords = arr.map((c) => cartesianToLonLat(c, ellipsoid));
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords },
          properties: {
            id: uuid,
            type: typeGuess,
          },
        });
      }
      // Area → Polygon
      else if (ent.polygon) {
        const arr = readPolygonPositions(ent, time);
        if (!arr?.length) continue;
        let coords = arr.map((c) => cartesianToLonLat(c, ellipsoid));
        // Ensure ring closure
        if (coords.length > 2) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coords = [...coords, first];
          }
        }
        features.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [coords] },
          properties: {
            id: uuid,
            type: typeGuess,
          },
        });
      }
    }

    const fc = { type: "FeatureCollection", features };

    // 🔴 This is the only part that changes:
    const blob = new Blob([JSON.stringify(fc, null, 2)], {
      type: "application/geo+json",
    });

    downloadBlobCrossBrowser(blob, "mina-objekt.geojson");
  }, []);

  const zoomIn = () => zoomToNextScaleStep(viewerRef.current, +1, 140);
  const zoomOut = () => zoomToNextScaleStep(viewerRef.current, -1, 140);

  function handleClickAddressDisplay(vref, lo, la) {
    zoomTo(vref.current, lo, la);
    zoomIn();
  }

  function rebuildLineJunctionPoints(ent, viewer, positions) {
    if (!ent || !viewer || !Array.isArray(positions)) return;

    const ch = (ent.__children ||= {});
    // Remove old point entities (from the edited session)
    if (Array.isArray(ch.points)) {
      for (const p of ch.points) {
        try {
          if (p) viewer.entities.remove(p);
        } catch {}
      }
    }
    ch.points = [];

    // Recreate from the reverted positions
    const g = pointGraphicsFromDraft(ent.__draft || {});
    const showPts = !!ent.__draft?.showPoints;

    for (const pos of positions) {
      const pointEnt = viewer.entities.add({
        position: pos,
        point: g,
        show: showPts,
      });
      pointEnt.__parent = ent;
      ch.points.push(pointEnt);
    }

    ent.__children = ch;
  }

  function rebuildAreaJunctionPoints(ent, viewer, positions, visible) {
    if (!ent || !viewer || !Array.isArray(positions)) return;

    const ch = (ent.__children ||= {});

    // Remove old point entities
    if (Array.isArray(ch.points)) {
      for (const p of ch.points) {
        try {
          if (p) viewer.entities.remove(p);
        } catch {}
      }
    }
    ch.points = [];

    // Styling from draft (fallbacks)
    const ps = ent.__draft?.pointSize ?? 8;
    const pc = ent.__draft?.pointColor ?? "#0066ff";

    const pointGraphics = {
      pixelSize: ps,
      color: Cesium.Color.fromCssColorString(pc),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: Math.max(1, Math.round(ps / 5)),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: Cesium.HeightReference.NONE,
    };

    const showPoints =
      typeof visible === "boolean" ? visible : !!ent.__draft?.showPoints;

    for (const pos of positions) {
      const pt = viewer.entities.add({
        position: pos,
        point: pointGraphics,
        show: showPoints,
      });
      pt.__parent = ent;
      ch.points.push(pt);
    }

    ent.__children = ch;
  }

  // --- Snapshot helpers (static arrays from Cesium properties) ---
  function snapshotPolygonPositions(ent, viewer) {
    const t = viewer?.clock?.currentTime;
    const h = ent?.polygon?.hierarchy;
    const val = h?.getValue ? h.getValue(t) : h;
    const arr =
      val && val.positions ? val.positions : Array.isArray(val) ? val : [];
    return arr.slice();
  }

  function snapshotPolylinePositions(ent, viewer) {
    const t = viewer?.clock?.currentTime;
    const p = ent?.polyline?.positions;
    const arr = Array.isArray(p) ? p : p?.getValue ? p.getValue(t) || [] : [];
    return arr.slice();
  }

  function rehydrateAreaJunctionPoints(ent, viewer) {
    if (!ent || !ent.polygon || !viewer) return;
    const t = viewer.clock.currentTime;
    const h = ent.polygon.hierarchy;
    const val = h?.getValue ? h.getValue(t) : h;
    const positions =
      val && val.positions ? val.positions : Array.isArray(val) ? val : [];

    if (!ent.__children) ent.__children = {};
    const ch = ent.__children;

    if (!Array.isArray(ch.points) || ch.points.length === 0) {
      ch.points = positions.map((pos) =>
        viewer.entities.add({
          position: pos,
          point: {
            pixelSize: ent.__draft?.pointSize ?? 8,
            color: Cesium.Color.fromCssColorString(
              ent.__draft?.pointColor ?? "#0066ff"
            ),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: Math.max(
              1,
              Math.round((ent.__draft?.pointSize ?? 8) / 5)
            ),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          show: true,
        })
      );
      for (const p of ch.points) p.__parent = ent;
    } else {
      for (const p of ch.points) if (p) p.show = true;
    }

    ent.__edit = ent.__edit || {};
    ent.__edit.pointsShownForEdit = true;
    ent.__children = ch;
  }

  function applyPolygonPositions(ent, positions) {
    if (!ent?.polygon) return;
    ent.polygon.hierarchy = new Cesium.PolygonHierarchy(positions.slice());
  }
  function applyPolylinePositions(ent, positions) {
    if (!ent?.polyline) return;
    ent.polyline.positions = positions.slice();
  }

  // --- Revert helper for MoveTool (restore from snapshot) ---
  const revertMoveToolChanges = useCallback(() => {
    const v = viewerRef.current;
    const snap = moveSnapshotRef.current;
    if (!v || !snap) return;

    for (const [uuid, saved] of snap.entries()) {
      const ent = entitiesRef.current.get(uuid);
      if (!ent) continue;

      if (saved.kind === "line" && ent.polyline) {
        applyPolylinePositions(ent, saved.positions);
        rebuildLineJunctionPoints(ent, v, saved.positions);
        try {
          rebuildSegmentLabels(ent, v);
          upsertTotalLengthLabel(ent, v);
        } catch {}
      } else if (saved.kind === "area" && ent.polygon) {
        applyPolygonPositions(ent, saved.positions);
        rebuildAreaJunctionPoints(
          ent,
          v,
          saved.positions,
          ent.__draft?.showPoints
        );
        try {
          rebuildAreaEdgeLabels(ent, v);
        } catch {}
        try {
          rebuildAreaLabel(ent, v);
        } catch {}
      } else if (saved.kind === "point") {
        if (ent.position) {
          ent.position = saved.position;
        }
      }
    }

    moveSnapshotRef.current = null;
    entitiesUpdateUI();
    v.scene.requestRender();
  }, [entitiesUpdateUI]);

  // ---------------- Right Pane routing (edits in SidebarRight) ----------------
  const [rightPane, setRightPane] = useState({ kind: "list" });

  // Draft state per kind
  const [textDraft, setTextDraft] = useState({
    text: "",
    color: "#ffffff",
    backgroundColor: "#111111",
    fontSize: 20,
    backgroundEnabled: true,
  });
  const [lineDraft, setLineDraft] = useState({
    lineColor: "#ff3b30",
    lineWidth: 3,
    lineType: "solid",
    pointColor: "#0066ff",
    pointSize: 8,
    showValues: true,
  });
  const [areaDraft, setAreaDraft] = useState(null);
  const [markerDraft, setMarkerDraft] = useState({
    pixelSize: 10,
    color: "#ff3b30",
    outlineColor: "#ffffff",
    outlineWidth: 2,
  });

  // --- Continue drawing session state ----------------------------------------
  // { kind: "line" | "area", uuid: string, originalPositions: Cartesian3[] } | null
  const [continueDrawState, setContinueDrawState] = useState(null);

  // Clear any "continue draw" session when we leave drawing tools
  useEffect(() => {
    const isDrawingTool =
      activeTool === "draw-lines" || activeTool === "draw-area";

    if (!isDrawingTool && continueDrawState) {
      setContinueDrawState(null);
      setRightPane({ kind: "list" });
    }
  }, [activeTool, continueDrawState]);

  const openEditForUuid = useCallback(
    (uuid) => {
      const ent = entitiesRef.current.get(uuid);
      if (!ent) return;

      const v = viewerRef.current;

      if (ent.polyline) {
        if (v) {
          ent.__edit = ent.__edit || {};
          ent.__edit.originalPositions = snapshotPolylinePositions(ent, v);
          startLineEdit(v, ent, {
            onAfterMutate: () => {
              ent.lastUpdated = new Date().toISOString();
              entitiesUpdateUI?.();
            },
          });
        }
        setLineDraft(draftFromLineEntity(ent));
        setRightPane({ kind: "edit-line", uuid });
        return;
      }

      if (ent.polygon) {
        if (v) {
          ent.__edit = ent.__edit || {};
          ent.__edit.originalPositions = snapshotPolygonPositions(ent, v);
          rehydrateAreaJunctionPoints(ent, v);
          startAreaEdit(v, ent, {
            onAfterMutate: () => {
              ent.lastUpdated = new Date().toISOString();
              entitiesUpdateUI?.();
            },
          });
        }
        setAreaDraft(draftFromAreaEntity ? draftFromAreaEntity(ent) : null);
        setRightPane({ kind: "edit-area", uuid });
        return;
      }

      if (
        (ent.point || ent.billboard) &&
        !ent.label &&
        !ent.polyline &&
        !ent.polygon
      ) {
        const d = draftFromMarkerEntity ? draftFromMarkerEntity(ent) : null;
        if (d) setMarkerDraft(d);
        setRightPane({ kind: "edit-marker", uuid });
        return;
      }

      if (ent.label && !ent.polyline && !ent.polygon) {
        const d = draftFromEntityLabel(ent);
        setTextDraft({
          text: d.text,
          color: d.color,
          backgroundColor: d.backgroundColor,
          fontSize: d.fontSize,
          backgroundEnabled:
            typeof d.backgroundEnabled === "boolean"
              ? d.backgroundEnabled
              : true,
        });
        setRightPane({ kind: "edit-text", uuid });
        return;
      }
    },
    [entitiesUpdateUI]
  );

  // --- Continue drawing helpers (triggered from modals) -----------------------
  const startContinueDrawForLine = useCallback(() => {
    const v = viewerRef.current;
    if (!v || rightPane.kind !== "edit-line") return;

    // 1) Commit any live junction-edit geometry and clean up handlers
    //    (so a stale _state can’t overwrite our line later)
    stopEdit();

    const uuid = rightPane.uuid;
    const ent = entitiesRef.current.get(uuid);
    if (!ent || !ent.polyline) return;

    // 2) Snapshot the CURRENT line geometry as the baseline for “continue draw”
    const positions = snapshotPolylinePositions(ent, v);
    if (!positions || !positions.length) return;

    setContinueDrawState({
      kind: "line",
      uuid,
      originalPositions: positions,
    });

    // 3) Switch into the drawing tool; DrawLines + ActiveToolModal take over
    setActiveTool("draw-lines");
  }, [rightPane, setActiveTool]);

  const startContinueDrawForArea = useCallback(() => {
    const v = viewerRef.current;
    if (!v || rightPane.kind !== "edit-area") return;

    // 1) Commit any live junction-edit geometry
    stopEdit();

    const uuid = rightPane.uuid;
    const ent = entitiesRef.current.get(uuid);
    if (!ent || !ent.polygon) return;

    // 2) Snapshot the CURRENT polygon positions as baseline
    const positions = snapshotPolygonPositions(ent, v);
    if (!positions || !positions.length) return;

    setContinueDrawState({
      kind: "area",
      uuid,
      originalPositions: positions,
    });

    // 3) Switch to area drawing tool
    setActiveTool("draw-area");
  }, [rightPane, setActiveTool]);

  // Confirm handlers (edits)
  const confirmTextEdit = useCallback(() => {
    const uuid = rightPane.uuid;
    const ent = entitiesRef.current.get(uuid);
    if (!ent) return setRightPane({ kind: "list" });

    applyDraftToEntityLabel(ent, textDraft);
    ent.lastUpdated = new Date().toISOString();
    ent.isActive = true;
    entitiesUpdateUI();
    setRightPane({ kind: "list" });
  }, [rightPane, textDraft, entitiesUpdateUI]);

  const confirmLineEdit = useCallback(() => {
    const uuid = rightPane.uuid;
    const ent = entitiesRef.current.get(uuid);
    const v = viewerRef.current;
    if (!ent || !v) return setRightPane({ kind: "list" });

    // 1) Snapshot CURRENT geometry (including any continue-draw changes)
    let confirmedPositions = snapshotPolylinePositions(ent, v) || [];

    // 2) Clean up edit session (junction drag, etc.)
    stopEdit();

    // 3) If for some reason snapshot failed, fall back to whatever is on the entity now
    if (!confirmedPositions.length) {
      confirmedPositions = snapshotPolylinePositions(ent, v) || [];
    }

    // 4) FIRST: re-apply the confirmed geometry to the entity
    if (confirmedPositions.length) {
      applyPolylinePositions(ent, confirmedPositions);
      ent.__positions = confirmedPositions.slice();

      ent.__edit = ent.__edit || {};
      ent.__edit.originalPositions = confirmedPositions.slice();
    }

    // 5) THEN: apply visual draft (color, width, labels, etc.)
    applyDraftToLineEntity(ent, lineDraft, v);
    setLineLabelsVisibility(ent, !!lineDraft.showValues, v);

    ent.lastUpdated = new Date().toISOString();
    ent.isActive = true;

    entitiesUpdateUI();
    setRightPane({ kind: "list" });
  }, [rightPane, lineDraft, entitiesUpdateUI]);

  const cancelActiveToolWithRevert = useCallback(() => {
    // Cancel → revert per-tool
    if (activeTool === "move-object") {
      revertMoveToolChanges();
    }

    const isContinueDrawing =
      (activeTool === "draw-lines" || activeTool === "draw-area") &&
      !!continueDrawState;

    if (isContinueDrawing && continueDrawState) {
      const v = viewerRef.current;
      if (v) {
        const { kind, uuid, originalPositions } = continueDrawState;
        const ent = entitiesRef.current.get(uuid);

        if (ent && Array.isArray(originalPositions)) {
          if (kind === "line" && ent.polyline) {
            // Revert geometry
            applyPolylinePositions(ent, originalPositions);
            rebuildLineJunctionPoints(ent, v, originalPositions);
            try {
              rebuildSegmentLabels(ent, v);
              upsertTotalLengthLabel(ent, v);
            } catch {}

            // 🔧 NEW: also reset the edit baseline
            ent.__edit = ent.__edit || {};
            ent.__edit.originalPositions = originalPositions.slice();
          } else if (kind === "area" && ent.polygon) {
            // Revert geometry
            applyPolygonPositions(ent, originalPositions);
            rebuildAreaJunctionPoints(
              ent,
              v,
              originalPositions,
              ent.__draft?.showPoints
            );
            try {
              rebuildAreaEdgeLabels(ent, v);
            } catch {}
            try {
              rebuildAreaLabel(ent, v);
            } catch {}

            ent.show = true;
            // 🔧 NEW: also reset the edit baseline
            ent.__edit = ent.__edit || {};
            ent.__edit.originalPositions = originalPositions.slice();
          }

          ent.lastUpdated = new Date().toISOString();
          entitiesUpdateUI?.();
          v.scene.requestRender?.();
        }
      }

      setContinueDrawState(null);
      setRightPane({ kind: "list" }); // cancel also returns to list
    }

    setActiveTool("no-tool");
  }, [activeTool, continueDrawState, entitiesUpdateUI]);

  const confirmAreaEdit = useCallback(() => {
    const uuid = rightPane.uuid;
    const ent = entitiesRef.current.get(uuid);
    const v = viewerRef.current;
    if (!ent || !v) return setRightPane({ kind: "list" });

    stopEdit();

    const editedDraft = { ...(areaDraft || {}), showPoints: false };
    applyDraftToAreaEntity(ent, editedDraft, v);

    if (ent.__children && Array.isArray(ent.__children.points)) {
      for (const p of ent.__children.points) {
        if (p) p.show = false;
      }
    }

    const confirmedPositions = snapshotPolygonPositions(ent, v);
    ent.__positions = confirmedPositions.slice();
    ent.__edit = ent.__edit || {};
    ent.__edit.originalPositions = confirmedPositions.slice();

    ent.lastUpdated = new Date().toISOString();
    ent.isActive = true;

    entitiesUpdateUI();
    setRightPane({ kind: "list" });
  }, [rightPane, areaDraft, entitiesUpdateUI]);

  const confirmMarkerEdit = useCallback(() => {
    const uuid = rightPane.uuid;
    const ent = entitiesRef.current.get(uuid);
    if (!ent) return setRightPane({ kind: "list" });

    applyDraftToMarkerEntity(ent, markerDraft);
    ent.lastUpdated = new Date().toISOString();
    ent.isActive = true;
    entitiesUpdateUI();
    setRightPane({ kind: "list" });
  }, [rightPane, markerDraft, entitiesUpdateUI]);

  const closeRightPane = useCallback(() => {
    if (rightPane.kind === "edit-line" || rightPane.kind === "edit-area") {
      const v = viewerRef.current;
      const ent = entitiesRef.current.get(rightPane.uuid);

      stopEdit();

      if (v && ent?.__edit?.originalPositions) {
        if (rightPane.kind === "edit-line" && ent.polyline) {
          applyPolylinePositions(ent, ent.__edit.originalPositions);
          rebuildLineJunctionPoints(ent, v, ent.__edit.originalPositions);
          setLineLabelsVisibility(ent, !!ent.__draft?.showValues, v);
        } else if (rightPane.kind === "edit-area" && ent.polygon) {
          applyPolygonPositions(ent, ent.__edit.originalPositions);
          if (ent.__children?.points?.length) {
            for (const p of ent.__children.points) if (p) p.show = false;
          }
          rebuildAreaJunctionPoints(
            ent,
            v,
            ent.__edit.originalPositions,
            ent.__draft?.showPoints
          );

          try {
            rebuildAreaEdgeLabels(ent, v);
          } catch {}
          try {
            rebuildAreaLabel(ent, v);
          } catch {}
        }
        ent.lastUpdated = new Date().toISOString();
      }
    }
    setRightPane({ kind: "list" });
  }, [rightPane]);

  // ---------------- PLACE TEXT flow (AddText → SidebarRight modal) ------------
  const [placeTextState, setPlaceTextState] = useState({
    open: false,
    position: null,
    draft: {
      text: "",
      color: "#ffffff",
      backgroundColor: "#111111",
      fontSize: 20,
      backgroundEnabled: true,
    },
  });

  const onRequestPlaceText = useCallback((position) => {
    setPlaceTextState({
      open: true,
      position,
      draft: {
        text: "",
        color: "#ffffff",
        backgroundColor: "#111111",
        fontSize: 20,
        backgroundEnabled: true,
      },
    });
  }, []);

  const setPlaceTextDraft = useCallback((updater) => {
    setPlaceTextState((s) => ({
      ...s,
      draft: typeof updater === "function" ? updater(s.draft) : updater,
    }));
  }, []);

  const confirmPlaceText = useCallback(() => {
    const v = viewerRef.current;
    const pos = placeTextState.position;
    if (!v || !pos) {
      setPlaceTextState((s) => ({ ...s, open: false, position: null }));
      setActiveTool("no-tool");
      return;
    }

    const { text, color, backgroundColor, fontSize, backgroundEnabled } =
      placeTextState.draft;

    const uuid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    const ent = v.entities.add({
      id: uuid,
      position: pos,
      label: {
        text,
        font: `${fontSize}px Barlow`,
        fillColor: Cesium.Color.fromCssColorString(color),
        showBackground: !!backgroundEnabled,
        backgroundColor: Cesium.Color.fromCssColorString(backgroundColor),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      show: true,
    });

    ent.type = "Text";
    ent.isActive = true;
    ent.lastUpdated = new Date().toISOString();
    ent.__draft = {
      text,
      color,
      backgroundColor,
      fontSize,
      backgroundEnabled,
    };

    setEntitiesRef(uuid, ent);

    setPlaceTextState({
      open: false,
      position: null,
      draft: {
        text: "",
        color: "#ffffff",
        backgroundColor: "#111111",
        fontSize: 20,
        backgroundEnabled: true,
      },
    });
    setActiveTool("no-tool");
  }, [placeTextState, setEntitiesRef]);

  const cancelPlaceText = useCallback(() => {
    setPlaceTextState({
      open: false,
      position: null,
      draft: {
        text: "",
        color: "#ffffff",
        backgroundColor: "#111111",
        fontSize: 20,
        backgroundEnabled: true,
      },
    });
    setActiveTool("no-tool");
  }, []);

  // ---------------- SidebarRight content (NO useMemo: depend on uiTick) -------
  function renderRightPane() {
    if (activeTool !== "no-tool" && !placeTextState.open) {
      const isMoveTool = activeTool === "move-object";
      const isContinueDrawing =
        (activeTool === "draw-lines" || activeTool === "draw-area") &&
        !!continueDrawState;

      return (
        <ActiveToolModal
          open
          activeTool={activeTool}
          onConfirmExit={() => {
            const isMoveTool = activeTool === "move-object";
            const isContinueDrawing =
              (activeTool === "draw-lines" || activeTool === "draw-area") &&
              !!continueDrawState;

            // Confirm → keep changes
            if (isMoveTool) {
              // Move tool: discard snapshot
              moveSnapshotRef.current = null;
            }

            if (isContinueDrawing) {
              // Drawing tools have already finalized geometry in DrawLines/DrawArea.
              // Clear continue-draw session and close any edit pane → go back to list.
              setContinueDrawState(null);
              setRightPane({ kind: "list" });
            }

            setActiveTool("no-tool");
          }}
          onCancelExit={cancelActiveToolWithRevert}
          isMobile={isMobile}
        />
      );
    }

    if (placeTextState.open) {
      return (
        <TextModal
          open
          draft={placeTextState.draft}
          setDraft={setPlaceTextDraft}
          onConfirm={confirmPlaceText}
          onClose={cancelPlaceText}
          isPlaceText={true}
        />
      );
    }

    switch (rightPane.kind) {
      case "edit-text":
        return (
          <TextModal
            open
            draft={textDraft}
            setDraft={setTextDraft}
            onConfirm={confirmTextEdit}
            onClose={closeRightPane}
            isPlaceText={false}
          />
        );
      case "edit-line":
        return (
          <LinesModal
            open
            draft={lineDraft}
            setDraft={setLineDraft}
            onConfirm={confirmLineEdit}
            onClose={closeRightPane}
            isPlaceLine={false}
            onContinueDraw={startContinueDrawForLine}
          />
        );
      case "edit-area":
        return (
          <AreaModal
            open
            draft={areaDraft || {}}
            setDraft={setAreaDraft}
            onConfirm={confirmAreaEdit}
            onClose={closeRightPane}
            isCreate={false}
            onContinueDraw={startContinueDrawForArea}
          />
        );
      case "edit-marker":
        return (
          <MarkerModal
            open
            draft={markerDraft}
            setDraft={setMarkerDraft}
            onConfirm={confirmMarkerEdit}
            onClose={closeRightPane}
            isCreate={false}
          />
        );
      default:
        return (
          <MyObjects
            uiTick={uiTick}
            entitiesUpdateUI={entitiesUpdateUI}
            entitiesRef={entitiesRef}
            removeAllInactiveEntitiesRef={removeAllInactiveEntitiesRef}
            updateShowHideEntitiesRef={updateShowHideEntitiesRef}
            viewer={viewerRef}
            onEdit={openEditForUuid}
            isMobile={isMobile}
            onDownloadMap={handleDownloadMap}
            onDownloadJson={handleDownloadGeoJSON}
            activeTool={activeTool}
          />
        );
    }
  }

  const isRenderSidebar = !isMobile || isUserShowMenu;

  return (
    <>
      <Topbar
        isStartpage={false}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        setPickedAddress={setPickedAddress}
        isMobile={isMobile}
        setIsUserShowMenu={setIsUserShowMenu}
        handleDownloadMap={handleDownloadMap}
        handleDownloadJson={handleDownloadGeoJSON}
      />
      {isRenderSidebar && (
        <Sidebar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          setIsUserShowMenu={setIsUserShowMenu}
          isMobile={isMobile}
        />
      )}

      <SidebarRight>{renderRightPane()}</SidebarRight>

      <main className="main">
        <h2
          className="heading-address-display"
          onClick={() => handleClickAddressDisplay(viewerRef, lon, lat)}
        >
          {pickedAddress.properties.td_adress}
        </h2>

        <Globe
          pickedAddress={pickedAddress}
          onReady={handleReady}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          setEntitiesRef={setEntitiesRef}
          entitiesUpdateUI={entitiesUpdateUI}
          entitiesRef={entitiesRef}
          onRequestPlaceText={onRequestPlaceText}
          onCancelPlaceText={cancelPlaceText}
          onPickEdit={openEditForUuid}
          revertMoveToolChanges={revertMoveToolChanges}
          continueDrawState={continueDrawState}
          cancelWithRevert={cancelActiveToolWithRevert}
        />
      </main>
    </>
  );
}
