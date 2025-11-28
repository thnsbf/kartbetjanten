// src/components/Tools/EditJunctions/editGeometry.js
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  PolygonHierarchy,
  CallbackProperty,
} from "cesium";
import { rebuildAreaLabel, rebuildAreaEdgeLabels } from "../DrawArea/areaDraft";
import {
  rebuildSegmentLabels,
  upsertTotalLengthLabel,
  segmentInfo,
  formatMeters,
} from "../DrawLines/linesDraft";

let _state = {
  viewer: null,
  ent: null, // entity being edited
  handler: null,
  dragging: false,
  dragIdx: -1,
  kind: null, // "area" | "line"
  cameraSaved: null,

  // Live geometry arrays for smooth editing
  linePositions: null, // Array<Cartesian3> used by polyline CallbackProperty
  polygonPositions: null, // Array<Cartesian3> used by polygon CallbackProperty
};

/**
 * Disable user camera controls while dragging edit junctions.
 */
function _disableCamera(scene) {
  if (!scene || !scene.screenSpaceCameraController) return;
  const ssc = scene.screenSpaceCameraController;

  _state.cameraSaved = {
    enableTranslate: ssc.enableTranslate,
    enableZoom: ssc.enableZoom,
    enableTilt: ssc.enableTilt,
    enableRotate: ssc.enableRotate,
  };

  ssc.enableTranslate = false;
  ssc.enableZoom = false;
  ssc.enableTilt = false;
  ssc.enableRotate = false;
}

/**
 * Restore camera controller flags after editing finishes.
 */
function _restoreCamera(scene) {
  if (!scene || !scene.screenSpaceCameraController || !_state.cameraSaved)
    return;

  const ssc = scene.screenSpaceCameraController;
  ssc.enableTranslate = _state.cameraSaved.enableTranslate;
  ssc.enableZoom = _state.cameraSaved.enableZoom;
  ssc.enableTilt = _state.cameraSaved.enableTilt;
  ssc.enableRotate = _state.cameraSaved.enableRotate;
}

/**
 * Read polygon positions in world coordinates.
 */
function _positionsForPolygon(ent, viewer) {
  if (!ent?.polygon) return [];
  const hierarchyProp = ent.polygon.hierarchy;
  if (!hierarchyProp) return [];

  let val = hierarchyProp;
  try {
    if (hierarchyProp.getValue && viewer?.clock?.currentTime) {
      val = hierarchyProp.getValue(viewer.clock.currentTime);
    }
  } catch {
    // ignore
  }

  if (!val) return [];
  if (val instanceof PolygonHierarchy) return val.positions || [];
  if (Array.isArray(val)) return val;

  return [];
}

/**
 * Write polygon positions back to the entity.
 */
function _writePositionsForPolygon(ent, positions) {
  if (!ent?.polygon) return;
  ent.polygon.hierarchy = new PolygonHierarchy(positions.slice());
}

/**
 * Read polyline positions in world coordinates.
 */
function _positionsForLine(ent, viewer) {
  if (!ent?.polyline) return [];
  const posProp = ent.polyline.positions;
  if (!posProp) return [];

  let val = posProp;
  try {
    if (posProp.getValue && viewer?.clock?.currentTime) {
      val = posProp.getValue(viewer.clock.currentTime);
    }
  } catch {
    // ignore
  }

  if (!val) return [];
  if (Array.isArray(val)) return val;

  return [];
}

/**
 * Write polyline positions back to the entity.
 */
function _writePositionsForLine(ent, positions) {
  if (!ent?.polyline) return;
  ent.polyline.positions = positions.slice();
}

/**
 * Find the index of a child point entity inside ent.__children.points.
 */
function _indexOfPoint(ent, pointEntity) {
  if (!ent?.__children || !Array.isArray(ent.__children.points)) return -1;
  const pts = ent.__children.points;
  return pts.findIndex((p) => p === pointEntity);
}

/**
 * Set the cursor for the Cesium canvas.
 */
function _setCursor(canvas, val) {
  if (canvas) canvas.style.cursor = val;
}

/**
 * Smooth, in-place update of line labels while dragging.
 * Uses the live editing array _state.linePositions when available.
 */
function _updateLineLabels(ent, viewer) {
  if (!ent || !ent.polyline || !viewer) return;

  const ch = (ent.__children ||= {});
  const labels = Array.isArray(ch.labels) ? ch.labels : [];
  const showValues = !!ent.__draft?.showValues;

  // Prefer live editing positions if we're editing this line
  const positions =
    _state.kind === "line" &&
    _state.ent === ent &&
    Array.isArray(_state.linePositions)
      ? _state.linePositions
      : _positionsForLine(ent, viewer);

  const ellipsoid = viewer.scene.globe.ellipsoid;

  if (!positions || positions.length < 2) {
    labels.forEach((l) => {
      if (l) l.show = false;
    });
    if (ch.totalLabel) ch.totalLabel.show = false;
    return;
  }

  const neededLabels = positions.length - 1;

  // If we don't have enough label entities yet, just rebuild once.
  if (showValues && labels.length < neededLabels) {
    rebuildSegmentLabels(ent, viewer);
    upsertTotalLengthLabel(ent, viewer);
    return;
  }

  const count = Math.min(labels.length, neededLabels);
  let totalMeters = 0;

  for (let i = 0; i < count; i++) {
    const { meters, mid } = segmentInfo(
      positions[i],
      positions[i + 1],
      ellipsoid
    );
    totalMeters += meters;

    const label = labels[i];
    if (!label) continue;
    label.position = mid;
    if (label.label) {
      label.label.text = formatMeters(meters);
    }
    label.show = showValues;
  }

  // If we have more segments than labels we updated, accumulate the rest
  if (neededLabels > count) {
    for (let i = count; i < neededLabels; i++) {
      totalMeters += segmentInfo(
        positions[i],
        positions[i + 1],
        ellipsoid
      ).meters;
    }
  }

  const showTotal =
    ent.__draft?.showTotalLabel ?? ent.__draft?.showValues ?? true;

  if (ch.totalLabel && positions.length > 0) {
    ch.totalLabel.position = positions[positions.length - 1];
    if (ch.totalLabel.label) {
      ch.totalLabel.label.text = `Total längd: ${formatMeters(totalMeters)}`;
    }
    ch.totalLabel.show = showTotal;
  }
}

/**
 * Rebuild labels / measurements after geometry mutates.
 * (Lines use the incremental updater above. Areas use full rebuild.)
 */
function _liveRefresh(ent, viewer) {
  if (!ent || !viewer) return;

  if (ent.polygon) {
    rebuildAreaLabel(ent, viewer);
    rebuildAreaEdgeLabels(ent, viewer);
  } else if (ent.polyline) {
    _updateLineLabels(ent, viewer);
  }
}

/**
 * Begin interactive edit of a polygon's junctions (areas) with smooth live geometry.
 */
export function startAreaEdit(viewer, ent, { onAfterMutate } = {}) {
  // Clear any existing edit state first
  stopEdit();
  if (!viewer || !ent?.polygon) return;

  _state.viewer = viewer;
  _state.ent = ent;
  _state.kind = "area";
  _state.dragging = false;
  _state.dragIdx = -1;

  const ch = (ent.__children ||= {});
  const pts = ch.points || [];
  for (const p of pts) if (p) p.show = true;

  // Snapshot positions and attach a CallbackProperty for smooth edits
  const originalPositions = _positionsForPolygon(ent, viewer);
  _state.polygonPositions = originalPositions.slice();

  ent.polygon.hierarchy = new CallbackProperty(
    () => new PolygonHierarchy(_state.polygonPositions || []),
    false
  );

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  _state.handler = handler;

  // SINGLE MOUSE_MOVE handler for both hover *and* drag
  handler.setInputAction((movement) => {
    const canvas = viewer.scene.canvas;

    if (_state.dragging) {
      // Dragging mode: move the current vertex
      const ellipsoid = viewer.scene.globe.ellipsoid;
      const cart = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
      if (!cart) return;

      const idx = _state.dragIdx;
      if (idx < 0) return;

      const childPoint = ent.__children.points[idx];
      if (childPoint) childPoint.position = cart;

      if (
        Array.isArray(_state.polygonPositions) &&
        idx < _state.polygonPositions.length
      ) {
        _state.polygonPositions[idx] = cart;
      }

      _liveRefresh(ent, viewer);
      onAfterMutate?.();
      viewer.scene.requestRender?.();
    } else {
      // Hover mode: show grab only when over a junction point
      const pick = viewer.scene.pick(movement.endPosition);
      const overPoint =
        pick &&
        pick.id &&
        Array.isArray(ch.points) &&
        ch.points.includes(pick.id);
      _setCursor(canvas, overPoint ? "grab" : "default");
    }
  }, ScreenSpaceEventType.MOUSE_MOVE);

  // Mouse down on a junction -> start dragging that junction.
  handler.setInputAction((down) => {
    const pick = viewer.scene.pick(down.position);
    if (!(pick && pick.id)) return;
    const idx = _indexOfPoint(ent, pick.id);
    if (idx < 0) return;

    _state.dragging = true;
    _state.dragIdx = idx;
    _disableCamera(viewer.scene);
    _setCursor(viewer.scene.canvas, "grabbing");
  }, ScreenSpaceEventType.LEFT_DOWN);

  // Mouse up: stop dragging and restore hover-based cursor.
  handler.setInputAction((up) => {
    if (!_state.dragging) return;
    _state.dragging = false;
    _state.dragIdx = -1;
    _restoreCamera(viewer.scene);

    const canvas = viewer.scene.canvas;
    const pick = viewer.scene.pick(up.position);
    const overPoint =
      pick &&
      pick.id &&
      Array.isArray(ch.points) &&
      ch.points.includes(pick.id);

    _setCursor(canvas, overPoint ? "grab" : "default");

    _liveRefresh(ent, viewer);
    onAfterMutate?.();
    viewer.scene.requestRender?.();
  }, ScreenSpaceEventType.LEFT_UP);
}

/**
 * Begin interactive edit of a polyline's junctions (lines) with smooth live geometry.
 */
export function startLineEdit(viewer, ent, { onAfterMutate } = {}) {
  // Clear any existing edit state first
  stopEdit();
  if (!viewer || !ent?.polyline) return;

  _state.viewer = viewer;
  _state.ent = ent;
  _state.kind = "line";
  _state.dragging = false;
  _state.dragIdx = -1;

  const ch = (ent.__children ||= {});
  const pts = ch.points || [];
  for (const p of pts) if (p) p.show = true;

  // Snapshot positions and attach a CallbackProperty to the existing polyline
  const originalPositions = _positionsForLine(ent, viewer);
  _state.linePositions = originalPositions.slice();

  ent.polyline.positions = new CallbackProperty(
    () => _state.linePositions || [],
    false
  );

  // Ensure labels exist once before editing (if they should be shown)
  if (ent.__draft?.showValues) {
    rebuildSegmentLabels(ent, viewer);
    upsertTotalLengthLabel(ent, viewer);
  }

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  _state.handler = handler;

  // SINGLE MOUSE_MOVE handler for both hover *and* drag
  handler.setInputAction((movement) => {
    const canvas = viewer.scene.canvas;

    if (_state.dragging) {
      // Dragging mode: move the current vertex
      const ellipsoid = viewer.scene.globe.ellipsoid;
      const cart = viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);
      if (!cart) return;

      const idx = _state.dragIdx;
      if (idx < 0) return;

      const childPoint = ent.__children.points[idx];
      if (childPoint) childPoint.position = cart;

      // Update our live editing array (driving the CallbackProperty)
      if (
        Array.isArray(_state.linePositions) &&
        idx < _state.linePositions.length
      ) {
        _state.linePositions[idx] = cart;
      }

      _liveRefresh(ent, viewer);
      onAfterMutate?.();
      viewer.scene.requestRender?.();
    } else {
      // Hover mode: show grab only when over a junction point
      const pick = viewer.scene.pick(movement.endPosition);
      const overPoint =
        pick &&
        pick.id &&
        Array.isArray(ch.points) &&
        ch.points.includes(pick.id);

      _setCursor(canvas, overPoint ? "grab" : "default");
    }
  }, ScreenSpaceEventType.MOUSE_MOVE);

  // Mouse down on a junction -> start dragging that junction.
  handler.setInputAction((down) => {
    const pick = viewer.scene.pick(down.position);
    if (!(pick && pick.id)) return;
    const idx = _indexOfPoint(ent, pick.id);
    if (idx < 0) return;

    _state.dragging = true;
    _state.dragIdx = idx;
    _disableCamera(viewer.scene);
    _setCursor(viewer.scene.canvas, "grabbing");
  }, ScreenSpaceEventType.LEFT_DOWN);

  // Mouse up: stop dragging and restore hover-based cursor.
  // IMPORTANT: we DO NOT commit positions here, so the CallbackProperty
  // stays alive across multiple drags in this edit session.
  handler.setInputAction((up) => {
    if (!_state.dragging) return;
    _state.dragging = false;
    _state.dragIdx = -1;
    _restoreCamera(viewer.scene);

    const canvas = viewer.scene.canvas;
    const pick = viewer.scene.pick(up.position);
    const overPoint =
      pick &&
      pick.id &&
      Array.isArray(ch.points) &&
      ch.points.includes(pick.id);

    _setCursor(canvas, overPoint ? "grab" : "default");

    _liveRefresh(ent, viewer);
    onAfterMutate?.();
    viewer.scene.requestRender?.();
  }, ScreenSpaceEventType.LEFT_UP);
}

/**
 * Stop any active junction editing session and clean up handlers / cursor.
 * For lines/areas, we also commit whatever is in the live arrays back to static
 * Cesium properties. Your Mainpage confirm/cancel logic can still restore
 * originalPositions via ent.__edit.originalPositions.
 */
export function stopEdit() {
  const v = _state.viewer;
  const ent = _state.ent;

  if (_state.handler) {
    _state.handler.destroy();
  }

  // Commit final line positions if we were editing a line
  if (ent?.polyline && Array.isArray(_state.linePositions)) {
    _writePositionsForLine(ent, _state.linePositions);
  }

  // Commit final polygon positions if we were editing an area
  if (ent?.polygon && Array.isArray(_state.polygonPositions)) {
    _writePositionsForPolygon(ent, _state.polygonPositions);
  }

  // Hide edit junction points again
  if (ent?.__children?.points) {
    for (const p of ent.__children.points) {
      if (p) p.show = false;
    }
  }

  if (v?.scene) {
    _restoreCamera(v.scene);
    _setCursor(v.scene.canvas, "default");
  }

  _state = {
    viewer: null,
    ent: null,
    handler: null,
    dragging: false,
    dragIdx: -1,
    kind: null,
    cameraSaved: null,
    linePositions: null,
    polygonPositions: null,
  };
}
