// src/components/Tools/EditJunctions/editGeometry.js
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  PolygonHierarchy,
} from "cesium";
import { rebuildAreaLabel, rebuildAreaEdgeLabels } from "../DrawArea/areaDraft";
import {
  rebuildSegmentLabels,
  upsertTotalLengthLabel,
} from "../DrawLines/linesDraft";
import { lift } from "../../../modules/utils";

let _state = {
  viewer: null,
  ent: null, // the entity being edited
  handler: null,
  dragging: false,
  dragIdx: -1,
  kind: null, // "area" | "line"
  cameraSaved: null,
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
 * Prefer the live polyline positions (ent.polyline.positions).
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
 * Rebuild labels / measurements after geometry mutates.
 */
function _liveRefresh(ent, viewer) {
  if (!ent || !viewer) return;

  if (ent.polygon) {
    rebuildAreaLabel(ent, viewer);
    rebuildAreaEdgeLabels(ent, viewer);
  } else if (ent.polyline) {
    rebuildSegmentLabels(ent, viewer);
    upsertTotalLengthLabel(ent, viewer);
  }
}

/**
 * Begin interactive edit of a polygon's junctions.
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

      const cur = _positionsForPolygon(ent, viewer).slice();
      if (idx >= cur.length) return;
      cur[idx] = cart;
      _writePositionsForPolygon(ent, cur);

      _liveRefresh(ent, viewer);
      onAfterMutate?.();
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
  }, ScreenSpaceEventType.LEFT_UP);
}

/**
 * Begin interactive edit of a polyline's junctions.
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

      const cur = _positionsForLine(ent, viewer).slice();
      if (idx >= cur.length) return;
      cur[idx] = cart;
      _writePositionsForLine(ent, cur);

      _liveRefresh(ent, viewer);
      onAfterMutate?.();
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
  }, ScreenSpaceEventType.LEFT_UP);
}

/**
 * Stop any active junction editing session and clean up handlers / cursor.
 */
export function stopEdit() {
  const v = _state.viewer;

  if (_state.handler) {
    _state.handler.destroy();
  }

  // Hide edit junction points again
  if (_state.ent?.__children?.points) {
    for (const p of _state.ent.__children.points) {
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
  };
}
