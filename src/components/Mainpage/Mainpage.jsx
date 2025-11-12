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

// Modals
import TextModal from "../TextModal/TextModal";
import LinesModal from "../LinesModal/LinesModal";
import AreaModal from "../AreaModal/AreaModal";
import MarkerModal from "../MarkerModal/MarkerModal";

// Draft helpers (apply + draftFrom)
import {
  draftFromEntityLabel,
  applyDraftToEntityLabel,
} from "../Tools/AddText/labelDraft";
import {
  draftFromLineEntity,
  applyDraftToLineEntity,
  setLineLabelsVisibility,
} from "../Tools/DrawLines/linesDraft";
import {
  draftFromAreaEntity,
  applyDraftToAreaEntity,
} from "../Tools/DrawArea/areaDraft";
import {
  draftFromMarkerEntity,
  applyDraftToMarkerEntity,
} from "../Tools/AddMarker/markersDraft";
import * as Cesium from "cesium";

export default function Mainpage({ pickedAddress, setPickedAddress }) {
  const [lon, lat] = pickedAddress.geometry.coordinates;

  const viewerRef = useRef(null);
  const entitiesRef = useRef(new Map());

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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
  const [isUserShowMenu, setIsUserShowMenu] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 992);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
          toggleArray(ch.points, v); // always show points with the line
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
      } catch {
        /* ignore */
      }
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

  const zoomIn = () => zoomToNextScaleStep(viewerRef.current, +1, 140);
  const zoomOut = () => zoomToNextScaleStep(viewerRef.current, -1, 140);

  function handleClickAddressDisplay(vref, lo, la) {
    zoomTo(vref.current, lo, la);
    zoomIn();
  }

  // ---------------- Right Pane routing (edits in SidebarRight) ----------------
  const [rightPane, setRightPane] = useState({ kind: "list" });

  // Draft state per kind
  const [textDraft, setTextDraft] = useState({
    text: "",
    color: "#ffffff",
    backgroundColor: "#111111",
    fontSize: 20,
    backgroundEnabled: true, // NEW
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

  // Edit router by geometry
  const openEditForUuid = useCallback((uuid) => {
    const ent = entitiesRef.current.get(uuid);
    if (!ent) return;

    if (ent.polyline) {
      setLineDraft(draftFromLineEntity(ent));
      setRightPane({ kind: "edit-line", uuid });
      return;
    }
    if (ent.polygon) {
      setAreaDraft(draftFromAreaEntity ? draftFromAreaEntity(ent) : null);
      setRightPane({ kind: "edit-area", uuid });
      return;
    }
    if (ent.point && !ent.label) {
      const d = draftFromMarkerEntity ? draftFromMarkerEntity(ent) : null;
      if (d) setMarkerDraft(d);
      setRightPane({ kind: "edit-marker", uuid });
      return;
    }
    if (ent.label && !ent.polyline && !ent.polygon) {
      const d = draftFromEntityLabel(ent);
      // Ensure flag exists for older entities
      setTextDraft({
        text: d.text,
        color: d.color,
        backgroundColor: d.backgroundColor,
        fontSize: d.fontSize,
        backgroundEnabled:
          typeof d.backgroundEnabled === "boolean" ? d.backgroundEnabled : true,
      });
      setRightPane({ kind: "edit-text", uuid });
      return;
    }
  }, []);

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

    applyDraftToLineEntity(ent, lineDraft, v);
    setLineLabelsVisibility(ent, !!lineDraft.showValues, v);
    entitiesUpdateUI();
    setRightPane({ kind: "list" });
  }, [rightPane, lineDraft, entitiesUpdateUI]);

  const confirmAreaEdit = useCallback(() => {
    const uuid = rightPane.uuid;
    const ent = entitiesRef.current.get(uuid);
    const v = viewerRef.current;
    if (!ent || !v) return setRightPane({ kind: "list" });

    applyDraftToAreaEntity(ent, areaDraft, v);
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

  const closeRightPane = useCallback(() => setRightPane({ kind: "list" }), []);

  // ---------------- PLACE TEXT flow (AddText → SidebarRight modal) ------------
  const [placeTextState, setPlaceTextState] = useState({
    open: false,
    position: null,
    draft: {
      text: "",
      color: "#ffffff",
      backgroundColor: "#111111",
      fontSize: 20,
      backgroundEnabled: true, // NEW
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
        backgroundEnabled: true, // NEW
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
        showBackground: !!backgroundEnabled, // NEW
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
      backgroundEnabled, // NEW (persist for hide/restore)
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
        backgroundEnabled: true, // NEW
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
        backgroundEnabled: true, // NEW
      },
    });
    setActiveTool("no-tool");
  }, []);

  // ---------------- SidebarRight content (NO useMemo: depend on uiTick) -------
  function renderRightPane() {
    // Place Text takes precedence when open
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
            isCreate={false}
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
            // >>> passing uiTick guarantees MyObjects re-renders on any entity change
            uiTick={uiTick}
            entitiesUpdateUI={entitiesUpdateUI}
            entitiesRef={entitiesRef}
            removeAllInactiveEntitiesRef={removeAllInactiveEntitiesRef}
            updateShowHideEntitiesRef={updateShowHideEntitiesRef}
            viewer={viewerRef}
            onEdit={openEditForUuid}
            isMobile={isMobile}
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
        rightPane={rightPane}
        setIsUserShowMenu={setIsUserShowMenu}
        placeTextState={placeTextState}
      />
      {isRenderSidebar && (
        <Sidebar
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          setIsUserShowMenu={setIsUserShowMenu}
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
        />
      </main>
    </>
  );
}
