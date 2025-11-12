// src/components/Tools/MoveTool/MoveTool.jsx
import { useEffect, useRef } from "react";
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartesian3,
  Cartographic,
  PolygonHierarchy,
  Color,
} from "cesium";
import { rebuildAreaEdgeLabels } from "../DrawArea/areaDraft";

function nowIso() {
  return new Date().toISOString();
}

// polyline helpers
function readPolylinePositions(ent, time) {
  if (!ent?.polyline?.positions) return [];
  const p = ent.polyline.positions;
  return Array.isArray(p) ? p : p.getValue?.(time) ?? [];
}
function writePolylinePositions(ent, arr) {
  if (!ent?.polyline) return;
  ent.polyline.positions = arr;
}

// polygon helpers
function readPolygonPositions(ent, time) {
  if (!ent?.polygon?.hierarchy) return [];
  const h = ent.polygon.hierarchy;
  const val = h.getValue ? h.getValue(time) : h;
  if (val instanceof PolygonHierarchy) return val.positions ?? [];
  return Array.isArray(val) ? val : [];
}
function writePolygonPositions(ent, arr) {
  if (!ent?.polygon) return;
  ent.polygon.hierarchy = new PolygonHierarchy(arr);
}

// conversions
function toCartographicAll(arr, ellipsoid) {
  return arr.map((c) => Cartographic.fromCartesian(c, ellipsoid));
}
function toCartesianAll(arr, ellipsoid) {
  return arr.map((gc) =>
    Cartesian3.fromRadians(gc.longitude, gc.latitude, gc.height ?? 0, ellipsoid)
  );
}
function applyDelta(cg, dLon, dLat) {
  return new Cartographic(cg.longitude + dLon, cg.latitude + dLat, cg.height ?? 0);
}

// parent resolution
function resolveRootEntity(pickedEnt, entitiesRef) {
  if (!pickedEnt) return null;
  if (pickedEnt.__parent) return pickedEnt.__parent;

  if (entitiesRef) {
    for (const [, candidate] of entitiesRef.current.entries()) {
      const ch = candidate.__children;
      if (!ch) continue;
      const inPoints = ch.points?.some((p) => p === pickedEnt) ?? false;
      const inLabels = Array.isArray(ch.labels)
        ? ch.labels.some((l) => l === pickedEnt)
        : (ch.label && ch.label === pickedEnt);
      const inTail = ch.tailPoint && ch.tailPoint === pickedEnt;
      const inMisc = Array.isArray(ch.misc) && ch.misc.includes(pickedEnt);

      if (inPoints || inLabels || inTail || inMisc) return candidate;
    }
  }
  return pickedEnt;
}

// label visibility toggles
function setLineLabelsVisible(ent, visible, viewer) {
  const labels = ent.__children?.labels || [];
  for (const l of labels) l.show = !!visible;
  viewer?.scene?.requestRender?.();
}
function setLineTotalLabelVisible(ent, visible, viewer) {
  const tl = ent.__children?.totalLabel;
  if (tl) tl.show = !!visible;
  viewer?.scene?.requestRender?.();
}
function setAreaLabelVisible(ent, visible, viewer) {
  const label = ent.__children?.label;
  if (label) label.show = !!visible;
  viewer?.scene?.requestRender?.();
}

// rebuilds (provide helpers from parents)
function rebuildLineLabels(ent, viewer, helpers) {
  const { segmentInfo, formatMeters } = helpers || {};
  if (!segmentInfo || !formatMeters) return;

  const ellipsoid = viewer.scene.globe.ellipsoid;
  const time = viewer.clock.currentTime;
  const positions = readPolylinePositions(ent, time);
  const ch = (ent.__children ||= {});

  // remove old segment labels
  if (Array.isArray(ch.labels)) {
    for (const l of ch.labels) viewer.entities.remove(l);
  }
  ch.labels = [];

  const showSegments = !!ent.__draft?.showValues;
  if (!showSegments || positions.length < 2) {
    ent.__children = ch;
  } else {
    for (let i = 0; i < positions.length - 1; i++) {
      const p0 = positions[i], p1 = positions[i + 1];
      const info = segmentInfo(p0, p1, ellipsoid);
      const label = viewer.entities.add({
        position: info.mid,
        label: {
          text: formatMeters(info.meters),
          font: "14px Barlow",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        show: true,
      });
      label.__parent = ent;
      ch.labels.push(label);
    }
    ent.__children = ch;
  }

  // Reposition total-length label (keep text; moving doesn't change length)
  if (ch.totalLabel && positions.length > 0) {
    const lastPos = positions[positions.length - 1];
    ch.totalLabel.position = lastPos;

    // Show or hide total per draft (if you support showTotal; fallback to showValues)
    const showTotal = ent.__draft?.showTotal ?? ent.__draft?.showValues ?? true;
    ch.totalLabel.show = !!showTotal;
  }
}

function rebuildAreaLabel(ent, viewer, helpers) {
  const { polygonCentroid, polygonAreaMeters2, formatSquareMeters } = helpers || {};
  if (!polygonCentroid || !polygonAreaMeters2 || !formatSquareMeters) return;

  const ellipsoid = viewer.scene.globe.ellipsoid;
  const time = viewer.clock.currentTime;
  const positions = readPolygonPositions(ent, time);
  const center = polygonCentroid(positions, ellipsoid);
  const area = polygonAreaMeters2(positions, ellipsoid);

  const ch = (ent.__children ||= {});
  if (ch.label) viewer.entities.remove(ch.label);

  const label = viewer.entities.add({
    position: center,
    label: {
      text: formatSquareMeters(area),
      font: "14px Barlow",
      fillColor: Color.WHITE,
      outlineColor: Color.BLACK,
      outlineWidth: 3,
      showBackground: true,
      backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    show: !!ent.__draft?.showAreaLabel,
  });
  label.__parent = ent;
  ch.label = label;
  ent.__children = ch;
}

export default function MoveTool({
  viewer,
  active,
  onCancel,
  entitiesRef,
  entitiesUpdateUI,
  lineHelpers, // { segmentInfo, formatMeters }
  areaHelpers, // { polygonCentroid, polygonAreaMeters2, formatSquareMeters }
}) {
  const draggingRef = useRef(false);
  const pickedRootRef = useRef(null);
  const startCartoRef = useRef(null);

  const pointCartoRef = useRef(null);
  const lineCartosRef = useRef(null);
  const areaCartosRef = useRef(null);

  const childPointsRef = useRef([]);

  useEffect(() => {
    if (!viewer || !active) return;

    const scene = viewer.scene;
    const canvas = scene.canvas;
    const ellipsoid = scene.globe.ellipsoid;
    const handler = new ScreenSpaceEventHandler(canvas);

    // move cursor
    canvas.style.cursor = "move";

    // disable camera during drag
    const ssc = scene.screenSpaceCameraController;
    const restore = {
      enableRotate: ssc.enableRotate,
      enableTranslate: ssc.enableTranslate,
      enableZoom: ssc.enableZoom,
      enableTilt: ssc.enableTilt,
      enableLook: ssc.enableLook,
    };
    const disableCamera = () => {
      ssc.enableRotate = false;
      ssc.enableTranslate = false;
      ssc.enableZoom = false;
      ssc.enableTilt = false;
      ssc.enableLook = false;
    };
    const restoreCamera = () => {
      ssc.enableRotate = restore.enableRotate;
      ssc.enableTranslate = restore.enableTranslate;
      ssc.enableZoom = restore.enableZoom;
      ssc.enableTilt = restore.enableTilt;
      ssc.enableLook = restore.enableLook;
    };

    const clearSnapshots = () => {
      draggingRef.current = false;
      pickedRootRef.current = null;
      startCartoRef.current = null;
      pointCartoRef.current = null;
      lineCartosRef.current = null;
      areaCartosRef.current = null;
      childPointsRef.current = [];
    };

    handler.setInputAction((down) => {
      const picked = scene.pick(down.position);
      if (!picked || !picked.id) return;

      const root = resolveRootEntity(picked.id, entitiesRef);
      if (!root) return;

      const p = viewer.camera.pickEllipsoid(down.position, ellipsoid);
      if (!p) return;

      disableCamera();

      draggingRef.current = true;
      pickedRootRef.current = root;
      startCartoRef.current = Cartographic.fromCartesian(p, ellipsoid);

      // hide labels while dragging
      if (root.polyline) {
        setLineLabelsVisible(root, false, viewer);
        setLineTotalLabelVisible(root, false, viewer);
      }
      if (root.polygon) setAreaLabelVisible(root, false, viewer);

      // gather child points (include any stray temp handles so they move too)
      const ch = root.__children || {};
      const base = Array.isArray(ch.points) ? ch.points.slice() : [];
      if (ch.tailPoint) base.push(ch.tailPoint);
      if (Array.isArray(ch.misc)) {
        base.push(...ch.misc.filter((x) => x && x.__isTemp));
      }
      childPointsRef.current = base;

      const time = viewer.clock.currentTime;

      if (root.point && !root.polyline && !root.polygon) {
        const pos = root.position?.getValue?.(time) ?? root.position;
        pointCartoRef.current = Cartographic.fromCartesian(pos, ellipsoid);
      } else if (root.label && !root.polyline && !root.polygon) {
        const pos = root.position?.getValue?.(time) ?? root.position;
        pointCartoRef.current = Cartographic.fromCartesian(pos, ellipsoid);
      } else if (root.polyline) {
        const arr = readPolylinePositions(root, time);
        lineCartosRef.current = toCartographicAll(arr, ellipsoid);
      } else if (root.polygon) {
        const arr = readPolygonPositions(root, time);
        areaCartosRef.current = toCartographicAll(arr, ellipsoid);
      }
    }, ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((move) => {
      if (!draggingRef.current) return;
      const root = pickedRootRef.current;
      if (!root) return;

      const p = viewer.camera.pickEllipsoid(move.endPosition, ellipsoid);
      if (!p || !startCartoRef.current) return;

      const cur = Cartographic.fromCartesian(p, ellipsoid);
      const dLon = cur.longitude - startCartoRef.current.longitude;
      const dLat = cur.latitude - startCartoRef.current.latitude;

      // single position (marker/text)
      if (pointCartoRef.current && (root.point || root.label) && !root.polyline && !root.polygon) {
        const newCarto = applyDelta(pointCartoRef.current, dLon, dLat);
        root.position = Cartesian3.fromRadians(newCarto.longitude, newCarto.latitude, newCarto.height ?? 0, ellipsoid);
      }
      // line
      else if (lineCartosRef.current && root.polyline) {
        const movedCartos = lineCartosRef.current.map((cg) => applyDelta(cg, dLon, dLat));
        const moved = toCartesianAll(movedCartos, ellipsoid);
        writePolylinePositions(root, moved);

        const cps = childPointsRef.current || [];
        for (let i = 0; i < cps.length && i < moved.length; i++) {
          cps[i].position = moved[i];
        }

        // Keep total-length label following the last vertex *during* drag
        const ch = root.__children || {};
        if (ch.totalLabel && moved.length > 0) {
          ch.totalLabel.position = moved[moved.length - 1];
        }
      }
      // area
      else if (areaCartosRef.current && root.polygon) {
        const movedCartos = areaCartosRef.current.map((cg) => applyDelta(cg, dLon, dLat));
        const moved = toCartesianAll(movedCartos, ellipsoid);
        writePolygonPositions(root, moved);

        const cps = childPointsRef.current || [];
        for (let i = 0; i < cps.length && i < moved.length; i++) {
          cps[i].position = moved[i];
        }
      }

      viewer.scene.requestRender();
    }, ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(() => {
      if (!draggingRef.current) {
        onCancel?.();
        return;
      }

      const root = pickedRootRef.current;
      if (root) {
        // rebuild labels
        if (root.polyline) {
          rebuildLineLabels(root, viewer, lineHelpers);

          // Ensure total-length label is visible per draft and positioned at the last vertex
          const ch = root.__children || {};
          const positions = readPolylinePositions(root, viewer.clock.currentTime);
          const showTotal = root.__draft?.showTotal ?? root.__draft?.showValues ?? true;
          if (ch.totalLabel) {
            if (positions.length > 0) {
              ch.totalLabel.position = positions[positions.length - 1];
            }
            ch.totalLabel.show = !!showTotal;
          }
        }

        if (root.polygon) {
          rebuildAreaLabel(root, viewer, areaHelpers);
          rebuildAreaEdgeLabels(root, viewer);
        }

        // purge temp handles if any survived
        const ch = root.__children || {};
        if (ch.tailPoint && ch.tailPoint.__isTemp) {
          viewer.entities.remove(ch.tailPoint);
          ch.tailPoint = null;
        }
        if (Array.isArray(ch.misc)) {
          ch.misc = ch.misc.filter((x) => {
            if (x && x.__isTemp) {
              viewer.entities.remove(x);
              return false;
            }
            return true;
          });
        }
        root.__children = ch;

        root.lastUpdated = nowIso();
        root.isActive = true;
      }

      // restore camera + reset drag state
      restoreCamera();
      clearSnapshots();
      entitiesUpdateUI?.();
      viewer.scene.requestRender();
    }, ScreenSpaceEventType.LEFT_UP);

    // cancel with ESC or RightClick
    const onKey = (e) => {
      if (e.key === "Escape") {
        restoreCamera();
        clearSnapshots();
        entitiesUpdateUI?.();
        onCancel?.();
      }
    };
    window.addEventListener("keydown", onKey);

    handler.setInputAction(() => {
      restoreCamera();
      clearSnapshots();
      entitiesUpdateUI?.();
      onCancel?.();
    }, ScreenSpaceEventType.RIGHT_CLICK);

    return () => {
      handler.destroy();
      window.removeEventListener("keydown", onKey);
      restoreCamera();
      clearSnapshots();
      if (canvas) canvas.style.cursor = "default";
    };
  }, [viewer, active, onCancel, entitiesRef, entitiesUpdateUI, lineHelpers, areaHelpers]);

  return null;
}
