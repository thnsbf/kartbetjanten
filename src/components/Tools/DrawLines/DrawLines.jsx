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
  onCancel, // () => setActiveTool("no-tool")
  setEntitiesRef, // (uuid, ent) => void
  entitiesUpdateUI, // () => void
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

  // Optional: committed polyline preview while drawing
  const committedLineRef = useRef(null);

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

  function finishLine() {
    const v = viewer;
    if (!v) return;
    const positions = committedPositionsRef.current;
    if (!Array.isArray(positions) || positions.length < 2) {
      // nothing to finalize
      clearTemps(v);
      removeCommittedLine(v);
      // exit tool
      v.scene.canvas.style.cursor = "default";
      onCancel?.();
      return;
    }

    // Clear temps
    clearTemps(v);
    removeCommittedLine(v);

    // Final line entity
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
    ent.__children = {
      points: pointEntsRef.current.slice(),
      labels: [],
      totalLabel: null,
      temp: null,
    };

    if (draftRef.current.showValues) {
      rebuildCommittedLabels(ent, v);
      upsertTotalLengthLabel(ent, v);
    }

    setEntitiesRef?.(uuid, ent);
    entitiesUpdateUI?.();

    // reset temp arrays (the created point entities now belong to ent)
    committedPositionsRef.current = [];
    pointEntsRef.current = [];
    mouseCartesianRef.current = null;

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

    // external finish signal (from ActiveToolModal)
    const onFinish = () => {
      finishLine();
    };
    window.addEventListener("kb:finish-active-tool", onFinish);

    // Disable Cesium default double-click zoom
    v.screenSpaceEventHandler?.removeInputAction?.(
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );

    // LEFT_CLICK: commit a point
    handler.setInputAction((e) => {
      const p = v.camera.pickEllipsoid(e.position, v.scene.globe.ellipsoid);
      if (!p) return;

      const pts = committedPositionsRef.current;
      pts.push(p);
      committedPositionsRef.current = pts;

      ensureCommittedLine(v);
      addCommittedPointEntity(v, p);
      ensureTempSegment(v);
    }, ScreenSpaceEventType.LEFT_CLICK);

    // LEFT_DOUBLE_CLICK: finish the line
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
        }
      }
      finishLine();
    }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // RIGHT_CLICK: undo last point (or cancel if none)
    handler.setInputAction(() => {
      const pts = committedPositionsRef.current;
      if (!pts.length) {
        clearTemps(v);
        removeCommittedLine(v);
        for (const p of pointEntsRef.current) v.entities.remove(p);
        pointEntsRef.current = [];
        committedPositionsRef.current = [];
        canvas.style.cursor = "default";
        onCancel?.();
        return;
      }
      pts.pop();
      committedPositionsRef.current = pts;

      const lastPoint = pointEntsRef.current.pop();
      if (lastPoint) v.entities.remove(lastPoint);

      if (pts.length === 0) {
        clearTemps(v);
        removeCommittedLine(v);
        canvas.style.cursor = "default";
        onCancel?.();
      }
    }, ScreenSpaceEventType.RIGHT_CLICK);

    // MOUSE_MOVE: update rubber & label
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

    // ESC: cancel
    const onKey = (ev) => {
      if (ev.key === "Escape") {
        clearTemps(v);
        removeCommittedLine(v);
        for (const p of pointEntsRef.current) v.entities.remove(p);
        pointEntsRef.current = [];
        committedPositionsRef.current = [];
        canvas.style.cursor = "default";
        onCancel?.();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      try {
        window.removeEventListener("kb:finish-active-tool", onFinish);
        clearTemps(v);
        removeCommittedLine(v);
        for (const p of pointEntsRef.current) v.entities.remove(p);
        pointEntsRef.current = [];
      } finally {
        canvas.style.cursor = "default";
        handlerRef.current?.destroy?.();
        handlerRef.current = null;
      }
      committedPositionsRef.current = [];
      mouseCartesianRef.current = null;
    };
  }, [viewer, active, onCancel, setEntitiesRef, entitiesUpdateUI]);

  return null;
}
