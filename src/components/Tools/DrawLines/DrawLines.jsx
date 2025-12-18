// src/components/Tools/DrawLines/DrawLines.jsx
import { useEffect, useRef } from "react";
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Color,
  Cartesian2,
  Cartesian3,
  CallbackProperty,
  LabelStyle,
  EllipsoidGeodesic,
} from "cesium";
import { v4 as uuidv4 } from "uuid";

import {
  defaultLineDraft,
  pointGraphicsFromDraft,
  rebuildCommittedLabels,
  upsertTotalLengthLabel,
  materialFromDraft,
  formatMeters,
} from "./linesDraft";

export default function DrawLines({
  viewer,
  active,
  onCancel,
  setEntitiesRef,
  entitiesUpdateUI,
  entitiesRef,
  continueDrawState,
}) {
  const handlerRef = useRef(null);

  // Draft + state
  const draftRef = useRef({ ...defaultLineDraft });

  const committedPositionsRef = useRef([]); // committed Cartesian3[]
  const pointEntsRef = useRef([]); // Cesium entities for junction points
  const mouseCartesianRef = useRef(null); // current mouse world pos (rubber)

  // Temps
  const tempSegmentRef = useRef(null); // current rubber-band segment entity
  const tempLabelRef = useRef(null); // current rubber-band label

  // Preview polyline while drawing
  const committedLineRef = useRef(null);

  // When continuing, keep track of the original entity so we can hide/show it
  const editingEntRef = useRef(null);

  const isContinuingLine =
    !!continueDrawState && continueDrawState.kind === "line";

  // Rubber-band positions between last committed point and mouse
  const rubberPositions = new CallbackProperty(() => {
    const pts = committedPositionsRef.current || [];
    const m = mouseCartesianRef.current;
    if (pts.length >= 1 && m) {
      const last = pts[pts.length - 1];
      return [last, m];
    }
    return [];
  }, false);

  function setCursor(canvas, value) {
    if (canvas) canvas.style.cursor = value;
  }

  function notifyDrawingState() {
    const hasPoints = (committedPositionsRef.current || []).length > 0;
    window.dispatchEvent(
      new CustomEvent("kb:drawing-state", {
        detail: { tool: "draw-lines", hasPoints },
      })
    );
  }

  function ensureCommittedLine(v) {
    if (!committedLineRef.current) {
      committedLineRef.current = v.entities.add({
        polyline: {
          positions: new CallbackProperty(
            () => committedPositionsRef.current.slice(),
            false
          ),
          width: draftRef.current.lineWidth,
          material: materialFromDraft(draftRef.current),
        },
        show: true,
      });
    }
  }

  function removeCommittedLine(v) {
    if (committedLineRef.current) {
      v.entities.remove(committedLineRef.current);
      committedLineRef.current = null;
    }
  }

  function ensureTempSegment(v) {
    if (!tempSegmentRef.current) {
      tempSegmentRef.current = v.entities.add({
        polyline: {
          positions: rubberPositions,
          width: Math.max(2, Math.min(4, draftRef.current.lineWidth)),
          material: Color.fromCssColorString(draftRef.current.lineColor),
        },
        show: true,
      });
    } else {
      tempSegmentRef.current.show = true;
    }
  }

  function removeTempSegment(v) {
    if (tempSegmentRef.current) {
      v.entities.remove(tempSegmentRef.current);
      tempSegmentRef.current = null;
    }
  }

  function upsertTempLabel(v) {
    const scene = v.scene;
    const ellipsoid = scene.globe.ellipsoid;
    const pts = committedPositionsRef.current || [];
    const m = mouseCartesianRef.current;
    if (!m || pts.length < 1) {
      if (tempLabelRef.current) {
        v.entities.remove(tempLabelRef.current);
        tempLabelRef.current = null;
      }
      return;
    }

    const a = pts[pts.length - 1];
    const cartoA = ellipsoid.cartesianToCartographic(a);
    const cartoB = ellipsoid.cartesianToCartographic(m);
    const g = new EllipsoidGeodesic(cartoA, cartoB);
    const meters = g.surfaceDistance;

    if (!tempLabelRef.current) {
      tempLabelRef.current = v.entities.add({
        position: m,
        label: {
          text: formatMeters(meters),
          font: "14px Barlow",
          style: LabelStyle.FILL_AND_OUTLINE,
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
      tempLabelRef.current.position = m;
      tempLabelRef.current.label.text = formatMeters(meters);
      tempLabelRef.current.show = true;
    }
  }

  function clearTemps(v) {
    removeTempSegment(v);
    if (tempLabelRef.current) {
      v.entities.remove(tempLabelRef.current);
      tempLabelRef.current = null;
    }
  }

  function addCommittedPointEntity(v, position) {
    const g = pointGraphicsFromDraft(draftRef.current);
    const p = v.entities.add({ position, point: g, show: true });
    pointEntsRef.current.push(p);
  }

  function restoreEditingEntityVisibility() {
    const ent = editingEntRef.current;
    if (ent) ent.show = true;
  }

  function finishLine() {
    const v = viewer;
    if (!v) return;
    const positions = committedPositionsRef.current;
    if (!Array.isArray(positions) || positions.length < 2) {
      clearTemps(v);
      removeCommittedLine(v);
      restoreEditingEntityVisibility();
      committedPositionsRef.current = [];
      pointEntsRef.current = [];
      mouseCartesianRef.current = null;
      editingEntRef.current = null;
      notifyDrawingState();
      setCursor(v.scene.canvas, "default");
      onCancel?.();
      return;
    }

    const continuing =
      isContinuingLine && continueDrawState && entitiesRef?.current;

    if (continuing) {
      const { uuid } = continueDrawState;
      const ent = editingEntRef.current || entitiesRef.current.get(uuid);

      if (ent && ent.polyline) {
        const merged = committedPositionsRef.current.slice();

        ent.polyline.positions = merged;
        ent.__positions = merged;
        ent.__edit = ent.__edit || {};
        ent.__edit.originalPositions = merged.slice();

        const ch = (ent.__children ||= {});
        const existingPoints = Array.isArray(ch.points) ? ch.points : [];
        for (const p of pointEntsRef.current) {
          if (!p) continue;
          p.__parent = ent;
          existingPoints.push(p);
        }
        ch.points = existingPoints;
        ent.__children = ch;

        rebuildCommittedLabels(ent, v);
        upsertTotalLengthLabel(ent, v);

        ent.isActive = true;
        ent.lastUpdated = new Date().toISOString();

        ent.show = true;
        editingEntRef.current = null;

        entitiesUpdateUI?.();
        v.scene.requestRender?.();

        clearTemps(v);
        removeCommittedLine(v);
        committedPositionsRef.current = [];
        pointEntsRef.current = [];
        mouseCartesianRef.current = null;
        notifyDrawingState();
        setCursor(v.scene.canvas, "default");
        onCancel?.();
        return;
      }
      // fallback continues into "new line" creation
    }

    // ---------------- CREATE NEW LINE PATH ----------------
    clearTemps(v);
    removeCommittedLine(v);

    const uuid = uuidv4();
    const ent = v.entities.add({
      id: uuid,
      polyline: {
        positions: positions.slice(),
        width: draftRef.current.lineWidth,
        material: materialFromDraft(draftRef.current),
      },
      show: true,
    });

    ent.type = "Linje";
    ent.isActive = true;
    ent.lastUpdated = new Date().toISOString();
    ent.__draft = { ...draftRef.current };
    ent.__positions = positions.slice();
    ent.__children = {
      points: pointEntsRef.current.slice(),
      labels: [],
      totalLabel: null,
      temp: null,
    };

    // ✅ independent toggles
    if (draftRef.current.showValues) {
      rebuildCommittedLabels(ent, v);
    }
    if (draftRef.current.showTotalLabel) {
      upsertTotalLengthLabel(ent, v);
    }

    setEntitiesRef?.(uuid, ent);
    entitiesUpdateUI?.();

    committedPositionsRef.current = [];
    pointEntsRef.current = [];
    mouseCartesianRef.current = null;
    editingEntRef.current = null;
    notifyDrawingState();

    setCursor(v.scene.canvas, "default");
    onCancel?.();
  }

  useEffect(() => {
    if (!viewer) return;
    const canvas = viewer.scene?.canvas;
    if (!canvas) return;

    setCursor(canvas, active ? "crosshair" : "default");

    return () => {
      setCursor(canvas, "default");
    };
  }, [viewer, active]);

  useEffect(() => {
    if (!viewer || !active) return;

    const v = viewer;
    const canvas = v.scene.canvas;
    setCursor(canvas, "crosshair");

    const handler = new ScreenSpaceEventHandler(canvas);
    handlerRef.current = handler;

    const onFinish = () => finishLine();

    const undoLastPoint = () => {
      const pts = committedPositionsRef.current;
      if (!pts.length) {
        clearTemps(v);
        removeCommittedLine(v);
        restoreEditingEntityVisibility();
        for (const p of pointEntsRef.current) v.entities.remove(p);
        pointEntsRef.current = [];
        committedPositionsRef.current = [];
        editingEntRef.current = null;
        notifyDrawingState();
        setCursor(canvas, "default");
        onCancel?.();
        return;
      }

      pts.pop();
      committedPositionsRef.current = pts;

      const lastPoint = pointEntsRef.current.pop();
      if (lastPoint) v.entities.remove(lastPoint);

      notifyDrawingState();

      if (pts.length === 0) {
        clearTemps(v);
        removeCommittedLine(v);
        restoreEditingEntityVisibility();
        editingEntRef.current = null;
        setCursor(canvas, "default");
        onCancel?.();
      }
    };

    window.addEventListener("kb:finish-active-tool", onFinish);
    window.addEventListener("kb:undo-active-tool", undoLastPoint);

    committedPositionsRef.current = [];
    pointEntsRef.current = [];
    mouseCartesianRef.current = null;
    committedLineRef.current = null;
    editingEntRef.current = null;

    if (isContinuingLine && continueDrawState?.uuid && entitiesRef?.current) {
      const { uuid, originalPositions } = continueDrawState;
      if (Array.isArray(originalPositions) && originalPositions.length > 0) {
        committedPositionsRef.current = originalPositions.slice();
      }

      const ent = entitiesRef.current.get(uuid);
      if (ent) {
        editingEntRef.current = ent;
        ent.show = false;

        const ch = ent.__children || {};
        if (Array.isArray(ch.points)) {
          for (const p of ch.points) {
            try {
              if (p && v.entities.contains(p)) v.entities.remove(p);
            } catch {}
          }
          ch.points = [];
        }
        if (Array.isArray(ch.labels)) {
          for (const l of ch.labels) {
            try {
              if (l && v.entities.contains(l)) v.entities.remove(l);
            } catch {}
          }
          ch.labels = [];
        }
        if (ch.totalLabel) {
          try {
            if (v.entities.contains(ch.totalLabel)) {
              v.entities.remove(ch.totalLabel);
            }
          } catch {}
          ch.totalLabel = null;
        }
        ent.__children = ch;
      }

      if (committedPositionsRef.current.length > 0) {
        ensureCommittedLine(v);
        for (const pos of committedPositionsRef.current) {
          addCommittedPointEntity(v, pos);
        }
      }
    }

    notifyDrawingState();

    v.screenSpaceEventHandler?.removeInputAction?.(
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );

    handler.setInputAction((e) => {
      const p = v.camera.pickEllipsoid(e.position, v.scene.globe.ellipsoid);
      if (!p) return;

      const pts = committedPositionsRef.current;
      pts.push(p);
      committedPositionsRef.current = pts;

      ensureCommittedLine(v);
      addCommittedPointEntity(v, p);
      ensureTempSegment(v);

      notifyDrawingState();
    }, ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
      const pts = committedPositionsRef.current;
      if (pts.length >= 2) {
        const a = pts[pts.length - 1];
        const b = pts[pts.length - 2];
        if (Cartesian3.distance(a, b) < 1e-6) {
          pts.pop();
          committedPositionsRef.current = pts;
          const lastPoint = pointEntsRef.current.pop();
          if (lastPoint) v.entities.remove(lastPoint);
          notifyDrawingState();
        }
      }
      finishLine();
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

      const hasAnchor = committedPositionsRef.current.length >= 1;
      if (hasAnchor && m) {
        ensureTempSegment(v);
        upsertTempLabel(v);
      } else {
        clearTemps(v);
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);

    const onKey = (ev) => {
      if (ev.key === "Escape") {
        clearTemps(v);
        removeCommittedLine(v);
        restoreEditingEntityVisibility();
        for (const p of pointEntsRef.current) v.entities.remove(p);
        pointEntsRef.current = [];
        committedPositionsRef.current = [];
        editingEntRef.current = null;
        notifyDrawingState();
        setCursor(canvas, "default");
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
        removeCommittedLine(v);
        restoreEditingEntityVisibility();
        for (const p of pointEntsRef.current) v.entities.remove(p);
        pointEntsRef.current = [];
      } finally {
        committedPositionsRef.current = [];
        mouseCartesianRef.current = null;
        editingEntRef.current = null;
        notifyDrawingState();
        setCursor(canvas, "default");
        handlerRef.current?.destroy?.();
        handlerRef.current = null;
      }
    };
  }, [
    viewer,
    active,
    onCancel,
    setEntitiesRef,
    entitiesUpdateUI,
    isContinuingLine,
    continueDrawState,
    entitiesRef,
  ]);

  return null;
}
