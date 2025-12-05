// src/components/Tools/DrawArea/DrawArea.jsx
import { useEffect, useRef } from "react";
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Color,
  Cartesian2,
  Cartesian3,
  PolygonHierarchy,
  CallbackProperty,
  SceneTransforms,
} from "cesium";
import { v4 as uuidv4 } from "uuid";

import {
  defaultAreaDraft,
  pointGraphicsFromDraft,
  polygonAreaMeters2,
  polygonCentroid,
  formatSquareMeters,
  rebuildAreaEdgeLabels,
  cesiumFillFromDraft,
  ensureAreaDraftShape,
} from "./areaDraft";

function firstPointHitTest(scene, firstCartesian, mousePosPx, radiusPx = 14) {
  if (!scene || !firstCartesian || !mousePosPx)
    return { hit: false, win: null };
  const win = SceneTransforms.worldToWindowCoordinates(
    scene,
    firstCartesian,
    new Cartesian2()
  );
  if (!win || !Number.isFinite(win.x) || !Number.isFinite(win.y))
    return { hit: false, win: null };
  const dx = mousePosPx.x - win.x;
  const dy = mousePosPx.y - win.y;
  return { hit: dx * dx + dy * dy <= radiusPx * radiusPx, win };
}

function almostSamePoint(a, b, eps = 0.01) {
  if (!a || !b) return false;
  return Cartesian3.distance(a, b) <= eps;
}

export default function DrawArea({
  viewer,
  active,
  onCancel,
  setEntitiesRef,
  entitiesUpdateUI,
  entitiesRef,
  continueDrawState,
}) {
  const handlerRef = useRef(null);

  const draftRef = useRef(ensureAreaDraftShape({ ...defaultAreaDraft }));
  const positionsRef = useRef([]); // committed vertices
  const pointEntsRef = useRef([]); // committed point marker entities
  const mouseCartesianRef = useRef(null);

  const tempLineRef = useRef(null);
  const tempPolyRef = useRef(null);
  const tempLabelRef = useRef(null);
  const firstPointEntityRef = useRef(null);
  const hoverOverFirstRef = useRef(false);
  const firstHintLabelRef = useRef(null);

  const editingEntRef = useRef(null);

  const isContinuingArea =
    !!continueDrawState && continueDrawState.kind === "area";

  function restoreEditingEntityVisibility() {
    const ent = editingEntRef.current;
    if (ent) ent.show = true;
  }

  const tempLinePositions = new CallbackProperty(() => {
    const pts = positionsRef.current || [];
    const m = mouseCartesianRef.current;
    if (pts.length === 1 && m) {
      return [pts[0], m];
    }
    return [];
  }, false);

  const tempPolyHierarchy = new CallbackProperty(() => {
    const pts = positionsRef.current || [];
    const m = mouseCartesianRef.current;
    if (pts.length >= 2 && m) {
      return new PolygonHierarchy([...pts, m]);
    }
    return new PolygonHierarchy([]);
  }, false);

  function removeTempLine(v) {
    if (tempLineRef.current) {
      v.entities.remove(tempLineRef.current);
      tempLineRef.current = null;
    }
  }
  function ensureTempLine(v) {
    if (!tempLineRef.current) {
      tempLineRef.current = v.entities.add({
        polyline: {
          positions: tempLinePositions,
          width: 2,
          material: Color.RED,
        },
        show: true,
      });
    }
  }

  function removeTempPoly(v) {
    if (tempPolyRef.current) {
      v.entities.remove(tempPolyRef.current);
      tempPolyRef.current = null;
    }
  }
  function ensureTempPoly(v, draft) {
    if (!tempPolyRef.current) {
      const safe = ensureAreaDraftShape(draft || draftRef.current);
      tempPolyRef.current = v.entities.add({
        polygon: {
          hierarchy: tempPolyHierarchy,
          material: cesiumFillFromDraft(safe),
          outline: true,
          outlineColor: Color.fromCssColorString(safe.outlineColor),
          outlineWidth: safe.outlineWidth,
        },
        show: false,
      });
    }
  }

  function upsertTempAreaLabel(v) {
    const pts = positionsRef.current;
    const m = mouseCartesianRef.current;
    const valid = Array.isArray(pts) && pts.length >= 2 && !!m;

    if (!valid) {
      if (tempLabelRef.current) {
        v.entities.remove(tempLabelRef.current);
        tempLabelRef.current = null;
      }
      return;
    }

    const ring = [...pts, m];
    const center = polygonCentroid(ring, v.scene.globe.ellipsoid);
    const area = polygonAreaMeters2(ring, v.scene.globe.ellipsoid);

    if (!tempLabelRef.current) {
      tempLabelRef.current = v.entities.add({
        position: center,
        label: {
          text: formatSquareMeters(area),
          font: "14px Barlow",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
          pixelOffset: new Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        show: true,
      });
    } else {
      tempLabelRef.current.position = center;
      tempLabelRef.current.label.text = formatSquareMeters(area);
      tempLabelRef.current.show = true;
    }
  }

  function clearTemps(v) {
    removeTempLine(v);
    removeTempPoly(v);
    if (tempLabelRef.current) {
      v.entities.remove(tempLabelRef.current);
      tempLabelRef.current = null;
    }
    removeFirstHintLabel(v);
  }

  function resetFirstMarkerSize() {
    const ent = firstPointEntityRef.current;
    if (ent) ent.point.pixelSize = draftRef.current?.pointSize ?? 8;
  }

  function cleanupPointsIfCancelled(v) {
    for (const p of pointEntsRef.current) v.entities.remove(p);
    pointEntsRef.current = [];
    firstPointEntityRef.current = null;
  }

  function refreshRubber(v) {
    const pts = positionsRef.current || [];
    const m = mouseCartesianRef.current;

    if (pts.length === 1 && m) {
      ensureTempLine(v);
      tempLineRef.current.show = true;
    } else if (tempLineRef.current) {
      tempLineRef.current.show = false;
    }

    const polygonValid = pts.length >= 2 && !!m;
    if (polygonValid) {
      ensureTempPoly(v, draftRef.current);
      tempPolyRef.current.show = true;
    } else if (tempPolyRef.current) {
      tempPolyRef.current.show = false;
    }

    if (polygonValid) {
      upsertTempAreaLabel(v);
    } else if (tempLabelRef.current) {
      v.entities.remove(tempLabelRef.current);
      tempLabelRef.current = null;
    }
  }

  function upsertFirstHintLabel(v, text) {
    const pts = positionsRef.current;
    if (!pts || pts.length === 0) {
      removeFirstHintLabel(v);
      return;
    }
    const pos = pts[0];
    if (!firstHintLabelRef.current) {
      firstHintLabelRef.current = v.entities.add({
        position: pos,
        label: {
          text,
          font: "13px Barlow",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Color.fromAlpha(Color.BLACK, 0.65),
          pixelOffset: new Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        show: true,
      });
    } else {
      firstHintLabelRef.current.position = pos;
      firstHintLabelRef.current.label.text = text;
      firstHintLabelRef.current.show = true;
    }
  }

  function removeFirstHintLabel(v) {
    if (firstHintLabelRef.current) {
      v.entities.remove(firstHintLabelRef.current);
      firstHintLabelRef.current = null;
    }
  }

  function updateCursor(v) {
    const canvas = v?.scene?.canvas;
    if (!canvas) return;

    const pts = positionsRef.current || [];

    if (hoverOverFirstRef.current) {
      canvas.style.cursor = pts.length >= 3 ? "pointer" : "not-allowed";
      return;
    }
    canvas.style.cursor = "crosshair";
  }

  // Broadcast "do we have any points yet?" to the modal
  function notifyDrawingState() {
    const hasPoints = (positionsRef.current || []).length > 0;
    window.dispatchEvent(
      new CustomEvent("kb:drawing-state", {
        detail: { tool: "draw-area", hasPoints },
      })
    );
  }

  function finishArea() {
    const v = viewer;
    if (!v) return;
    const pts = positionsRef.current;

    if (!Array.isArray(pts) || pts.length < 3) {
      // Not enough points → treat as cancel
      clearTemps(v);
      cleanupPointsIfCancelled(v);
      positionsRef.current = [];
      notifyDrawingState();
      v.scene.canvas.style.cursor = "default";

      // If we were editing an existing area, show it again
      restoreEditingEntityVisibility();

      onCancel?.();
      return;
    }

    const continuing =
      isContinuingArea && continueDrawState && entitiesRef?.current;

    if (continuing) {
      const { uuid } = continueDrawState;
      const ent = editingEntRef.current || entitiesRef.current.get(uuid);

      if (ent && ent.polygon) {
        const newPositions = pts.slice();

        // Update polygon geometry
        ent.polygon.hierarchy = new PolygonHierarchy(newPositions);
        ent.__positions = newPositions;
        ent.__edit = ent.__edit || {};
        ent.__edit.originalPositions = newPositions.slice();

        // Attach newly created junction points
        const ch = ent.__children || {};
        const existingPoints = Array.isArray(ch.points) ? ch.points : [];
        for (const p of pointEntsRef.current) {
          if (!p) continue;
          p.__parent = ent;
          existingPoints.push(p);
        }
        ch.points = existingPoints;

        // Remove any existing labels (we'll rebuild)
        if (Array.isArray(ch.edgeLabels)) {
          for (const lbl of ch.edgeLabels) {
            try {
              if (lbl && v.entities.contains(lbl)) v.entities.remove(lbl);
            } catch {}
          }
          ch.edgeLabels = [];
        }
        if (ch.label) {
          try {
            if (v.entities.contains(ch.label)) v.entities.remove(ch.label);
          } catch {}
          ch.label = null;
        }

        // Rebuild labels based on ent.__draft
        ent.__children = ch;
        const draft = ent.__draft || draftRef.current;

        const wantPointsVisible = !!draft.showPoints;
        if (Array.isArray(ch.points)) {
          for (const p of ch.points) {
            if (p) p.show = wantPointsVisible;
          }
        }

        try {
          if (draft.showAreaLabel) {
            const center = polygonCentroid(
              newPositions,
              v.scene.globe.ellipsoid
            );
            const area = polygonAreaMeters2(
              newPositions,
              v.scene.globe.ellipsoid
            );
            const centerLabel = v.entities.add({
              position: center,
              label: {
                text: formatSquareMeters(area),
                font: "14px Barlow",
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK,
                outlineWidth: 3,
                showBackground: true,
                backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
                pixelOffset: new Cartesian2(0, -12),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              show: true,
            });
            centerLabel.__parent = ent;
            ch.label = centerLabel;
          }
        } catch {}

        try {
          if (draft.showEdgeValues) {
            rebuildAreaEdgeLabels(ent, v);
          }
        } catch {}

        ent.isActive = true;
        ent.lastUpdated = new Date().toISOString();
        ent.show = true;
        editingEntRef.current = null;

        entitiesUpdateUI?.();
        v.scene.requestRender?.();

        // Cleanup tool state
        clearTemps(v);
        positionsRef.current = [];
        pointEntsRef.current = [];
        mouseCartesianRef.current = null;
        firstPointEntityRef.current = null;
        hoverOverFirstRef.current = false;
        removeFirstHintLabel(v);
        notifyDrawingState();
        v.scene.canvas.style.cursor = "default";
        onCancel?.(); // exit tool; ActiveToolModal will handle UI reset
        return;
      }
    }

    // ---------------- CREATE NEW AREA PATH (unchanged) ----------------
    clearTemps(v);
    resetFirstMarkerSize();

    const d = draftRef.current;
    const uuid = uuidv4();

    const ent = v.entities.add({
      id: uuid,
      polygon: {
        hierarchy: new PolygonHierarchy(pts.slice()),
        material: cesiumFillFromDraft(d),
        outline: true,
        outlineColor: Color.fromCssColorString(d.outlineColor),
        outlineWidth: d.outlineWidth,
      },
      show: true,
    });
    ent.__uuid = uuid;
    ent.type = "Area";
    ent.isActive = true;
    ent.lastUpdated = new Date().toISOString();
    ent.__draft = { ...d };
    ent.__children = {
      points: pointEntsRef.current.slice(),
      edgeLabels: [],
      label: null,
      temp: { poly: null, label: null },
    };

    // Default visibility flags
    for (const p of ent.__children.points) p.show = !!d.showPoints;

    if (d.showAreaLabel) {
      const center = polygonCentroid(pts, v.scene.globe.ellipsoid);
      const area = polygonAreaMeters2(pts, v.scene.globe.ellipsoid);
      const centerLabel = v.entities.add({
        position: center,
        label: {
          text: formatSquareMeters(area),
          font: "14px Barlow",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
          pixelOffset: new Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        show: true,
      });
      centerLabel.__parent = ent;
      ent.__children.label = centerLabel;
    }

    if (d.showEdgeValues) rebuildAreaEdgeLabels(ent, v);

    setEntitiesRef?.(uuid, ent);
    entitiesUpdateUI?.();

    positionsRef.current = [];
    pointEntsRef.current = [];
    firstPointEntityRef.current = null;
    mouseCartesianRef.current = null;
    removeFirstHintLabel(v);
    notifyDrawingState();
    v.scene.canvas.style.cursor = "default";
    onCancel?.();
  }

  useEffect(() => {
    if (!viewer || !active) return;

    const v = viewer;
    const canvas = v.scene.canvas;
    canvas.style.cursor = "crosshair";

    const handler = new ScreenSpaceEventHandler(canvas);
    handlerRef.current = handler;

    // External finish signal (from ActiveToolModal)
    const onFinish = () => {
      finishArea();
    };

    // Shared undo function
    const undoLastPoint = () => {
      const pts = positionsRef.current;
      if (!pts.length) {
        clearTemps(v);
        cleanupPointsIfCancelled(v);
        canvas.style.cursor = "default";
        positionsRef.current = [];
        notifyDrawingState();
        onCancel?.();
        return;
      }

      pts.pop();
      positionsRef.current = pts;
      const lastEnt = pointEntsRef.current.pop();
      if (lastEnt) v.entities.remove(lastEnt);

      if (firstPointEntityRef.current && pts.length <= 1) {
        resetFirstMarkerSize();
      }

      refreshRubber(v);
      removeFirstHintLabel(v);
      updateCursor(v);

      notifyDrawingState();
    };

    window.addEventListener("kb:finish-active-tool", onFinish);
    window.addEventListener("kb:undo-active-tool", undoLastPoint);

    // ---------------- INIT STATE FOR THIS SESSION ----------------
    positionsRef.current = [];
    pointEntsRef.current = [];
    mouseCartesianRef.current = null;
    firstPointEntityRef.current = null;
    hoverOverFirstRef.current = false;
    firstHintLabelRef.current = null;
    editingEntRef.current = null;

    // CONTINUE DRAW: seed positions from existing entity + hide it
    if (isContinuingArea && continueDrawState?.uuid && entitiesRef?.current) {
      const { uuid, originalPositions } = continueDrawState;

      if (Array.isArray(originalPositions) && originalPositions.length > 0) {
        positionsRef.current = originalPositions.slice();
      }

      const ent = entitiesRef.current.get(uuid);
      if (ent) {
        editingEntRef.current = ent;

        // Hide original polygon while we are in drawing mode
        ent.show = false;

        // Use the entity's current draft (for colors, outline, etc.)
        if (ent.__draft) {
          draftRef.current = ensureAreaDraftShape(ent.__draft);
        } else {
          draftRef.current = ensureAreaDraftShape({ ...defaultAreaDraft });
        }

        // Remove old junction points + labels from the entity
        const ch = ent.__children || {};
        if (Array.isArray(ch.points)) {
          for (const p of ch.points) {
            try {
              if (p && viewer.entities.contains(p)) viewer.entities.remove(p);
            } catch {}
          }
          ch.points = [];
        }
        if (Array.isArray(ch.edgeLabels)) {
          for (const l of ch.edgeLabels) {
            try {
              if (l && viewer.entities.contains(l)) viewer.entities.remove(l);
            } catch {}
          }
          ch.edgeLabels = [];
        }
        if (ch.label) {
          try {
            if (viewer.entities.contains(ch.label)) {
              viewer.entities.remove(ch.label);
            }
          } catch {}
          ch.label = null;
        }
        ent.__children = ch;
      }

      // Create our own point entities based on the existing vertices
      if (positionsRef.current.length > 0) {
        const safeDraft = draftRef.current;
        const g = pointGraphicsFromDraft(safeDraft);
        positionsRef.current.forEach((pos, idx) => {
          const pt = viewer.entities.add({
            position: pos,
            point: g,
            show: true,
          });
          pt.__parent = editingEntRef.current || null;
          pointEntsRef.current.push(pt);
          if (idx === 0) firstPointEntityRef.current = pt;
        });
      }
    }

    // Now broadcast if we "already have points" (enables Ångra in ActiveToolModal)
    notifyDrawingState();

    v.screenSpaceEventHandler?.removeInputAction?.(
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );

    handler.setInputAction((e) => {
      const p = v.camera.pickEllipsoid(e.position, v.scene.globe.ellipsoid);
      if (!p) return;

      const pts = positionsRef.current;

      if (hoverOverFirstRef.current && pts.length >= 3) {
        finishArea();
        return;
      }

      pts.push(p);
      positionsRef.current = pts;

      if (pts.length === 1) {
        const g = pointGraphicsFromDraft(draftRef.current);
        const fp = v.entities.add({ position: p, point: g, show: true });
        firstPointEntityRef.current = fp;
        pointEntsRef.current.push(fp);
      } else {
        pointEntsRef.current.push(
          v.entities.add({
            position: p,
            point: pointGraphicsFromDraft(draftRef.current),
            show: true,
          })
        );
      }

      refreshRubber(v);
      removeFirstHintLabel(v);
      updateCursor(v);
      notifyDrawingState();
    }, ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
      const pts = positionsRef.current || [];
      if (pts.length < 3) return;

      if (
        pts.length >= 2 &&
        almostSamePoint(pts[pts.length - 1], pts[pts.length - 2])
      ) {
        pts.pop();
        positionsRef.current = pts;
        const lastPointEnt = pointEntsRef.current.pop();
        if (lastPointEnt && viewer) viewer.entities.remove(lastPointEnt);
        notifyDrawingState();
      }

      finishArea();
    }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    handler.setInputAction(() => {
      undoLastPoint();
    }, ScreenSpaceEventType.RIGHT_CLICK);

    handler.setInputAction((movement) => {
      const m = v.camera.pickEllipsoid(
        movement.endPosition,
        v.scene.globe.ellipsoid
      );
      mouseCartesianRef.current = m || null;

      refreshRubber(v);

      const pts = positionsRef.current;
      const first = pts && pts[0];
      if (first) {
        const { hit } = firstPointHitTest(
          v.scene,
          first,
          new Cartesian2(movement.endPosition.x, movement.endPosition.y),
          14
        );
        const prev = hoverOverFirstRef.current;
        hoverOverFirstRef.current = !!hit;

        if (firstPointEntityRef.current) {
          const baseSize = draftRef.current?.pointSize ?? 8;
          const enlarged = Math.max(baseSize + 4, 12);
          firstPointEntityRef.current.point.pixelSize =
            hit && pts.length >= 3 ? enlarged : baseSize;
        }

        if (hoverOverFirstRef.current) {
          const text =
            pts.length >= 3
              ? "Fastställ area"
              : "En area måste ha minst 3 punkter";
          upsertFirstHintLabel(v, text);
        } else {
          removeFirstHintLabel(v);
        }
      } else {
        removeFirstHintLabel(v);
      }

      updateCursor(v);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    const onKey = (ev) => {
      if (ev.key === "Escape") {
        clearTemps(v);
        cleanupPointsIfCancelled(v);
        canvas.style.cursor = "default";
        positionsRef.current = [];
        notifyDrawingState();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      try {
        window.removeEventListener("kb:finish-active-tool", onFinish);
        window.removeEventListener("kb:undo-active-tool", undoLastPoint);
        window.removeEventListener("keydown", onKey);
        clearTemps(v);
        cleanupPointsIfCancelled(v);
        resetFirstMarkerSize();
        removeFirstHintLabel(v);
        canvas.style.cursor = "default";
        handlerRef.current?.destroy?.();
        handlerRef.current = null;
        hoverOverFirstRef.current = false;
        positionsRef.current = [];
        notifyDrawingState();
      } finally {
      }
    };
  }, [
    viewer,
    active,
    onCancel,
    setEntitiesRef,
    entitiesUpdateUI,
    isContinuingArea,
    continueDrawState,
    entitiesRef,
  ]);

  return null;
}
