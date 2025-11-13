// src/components/Tools/EditJunctions/editGeometry.js
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  PolygonHierarchy,
  Color,
} from "cesium";
import { rebuildAreaLabel, rebuildAreaEdgeLabels } from "../DrawArea/areaDraft";
import {
  rebuildSegmentLabels,
  upsertTotalLengthLabel,
} from "../DrawLines/linesDraft";

let _state = {
  viewer: null,
  ent: null, // the entity being edited
  handler: null,
  dragging: false,
  dragIdx: -1,
  kind: null, // "area" | "line"
  cameraSaved: null,
};

function _restoreCamera(scene) {
  const ssc = scene?.screenSpaceCameraController;
  if (!ssc || !_state.cameraSaved) return;
  ssc.enableRotate = _state.cameraSaved.enableRotate;
  ssc.enableTranslate = _state.cameraSaved.enableTranslate;
  ssc.enableZoom = _state.cameraSaved.enableZoom;
  ssc.enableTilt = _state.cameraSaved.enableTilt;
  ssc.enableLook = _state.cameraSaved.enableLook;
  _state.cameraSaved = null;
}
function _disableCamera(scene) {
  const ssc = scene?.screenSpaceCameraController;
  if (!ssc) return;
  _state.cameraSaved = {
    enableRotate: ssc.enableRotate,
    enableTranslate: ssc.enableTranslate,
    enableZoom: ssc.enableZoom,
    enableTilt: ssc.enableTilt,
    enableLook: ssc.enableLook,
  };
  ssc.enableRotate = false;
  ssc.enableTranslate = false;
  ssc.enableZoom = false;
  ssc.enableTilt = false;
  ssc.enableLook = false;
}

function _positionsForArea(ent, viewer) {
  const t = viewer.clock.currentTime;
  const h = ent?.polygon?.hierarchy;
  const val = h?.getValue ? h.getValue(t) : h;
  if (!val) return [];
  if (val instanceof PolygonHierarchy) return val.positions || [];
  if (Array.isArray(val)) return val;
  return [];
}
function _writePositionsForArea(ent, positions) {
  if (!ent?.polygon) return;
  ent.polygon.hierarchy = new PolygonHierarchy(positions.slice());
}

function _positionsForLine(ent, viewer) {
  const p = ent?.polyline?.positions;
  if (!p) return [];
  if (Array.isArray(p)) return p;
  try {
    const val = p.getValue ? p.getValue(viewer.clock.currentTime) : p;
    return Array.isArray(val) ? val : [];
  } catch {
    return [];
  }
}
function _writePositionsForLine(ent, positions) {
  if (!ent?.polyline) return;
  ent.polyline.positions = positions.slice();
}

function _indexOfPoint(ent, pointEntity) {
  const pts = ent?.__children?.points || [];
  return pts.findIndex((p) => p === pointEntity);
}

function _setCursor(canvas, val) {
  if (canvas) canvas.style.cursor = val;
}

function _liveRefresh(ent, viewer) {
  if (!ent || !viewer) return;
  if (ent.polygon) {
    rebuildAreaLabel(ent, viewer);
    rebuildAreaEdgeLabels(ent, viewer);
  } else if (ent.polyline) {
    rebuildSegmentLabels(ent, viewer);
    upsertTotalLengthLabel(ent, viewer);
  }
  viewer.scene.requestRender?.();
}

// ---------- PUBLIC API (start/stop) ----------

export function startAreaEdit(viewer, ent, { onAfterMutate } = {}) {
  stopEdit(); // clear any previous
  if (!viewer || !ent?.polygon) return;

  _state.viewer = viewer;
  _state.ent = ent;
  _state.kind = "area";

  // Ensure points are visible (caller usually rehydrates; still force show)
  const ch = (ent.__children ||= {});
  const pts = ch.points || [];
  for (const p of pts) if (p) p.show = true;

  // input handler
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  _state.handler = handler;

  handler.setInputAction((movement) => {
    // Hover → show grab if over a junction point
    if (_state.dragging) return; // dragging decides its own cursor
    const pick = viewer.scene.pick(movement.endPosition);
    const overPoint =
      pick &&
      pick.id &&
      Array.isArray(ch.points) &&
      ch.points.includes(pick.id);
    _setCursor(viewer.scene.canvas, overPoint ? "grab" : "default");
  }, ScreenSpaceEventType.MOUSE_MOVE);

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

  handler.setInputAction((move) => {
    if (!_state.dragging) return;

    const ellipsoid = viewer.scene.globe.ellipsoid;
    const cart = viewer.camera.pickEllipsoid(move.endPosition, ellipsoid);
    if (!cart) return;

    // move the point entity
    const idx = _state.dragIdx;
    const childPoint = ent.__children.points[idx];
    if (childPoint) childPoint.position = cart;

    // update polygon positions array
    const cur = _positionsForArea(ent, viewer).slice();
    cur[idx] = cart;
    _writePositionsForArea(ent, cur);

    // live labels refresh
    _liveRefresh(ent, viewer);
    onAfterMutate?.();
  }, ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(() => {
    if (!_state.dragging) return;
    _state.dragging = false;
    _state.dragIdx = -1;
    _restoreCamera(viewer.scene);
    _setCursor(viewer.scene.canvas, "grab"); // still hovering most likely
    _liveRefresh(ent, viewer);
    onAfterMutate?.();
  }, ScreenSpaceEventType.LEFT_UP);
}

export function startLineEdit(viewer, ent, { onAfterMutate } = {}) {
  stopEdit(); // clear any previous
  if (!viewer || !ent?.polyline) return;

  _state.viewer = viewer;
  _state.ent = ent;
  _state.kind = "line";

  const ch = (ent.__children ||= {});
  const pts = ch.points || [];
  for (const p of pts) if (p) p.show = true;

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  _state.handler = handler;

  handler.setInputAction((movement) => {
    if (_state.dragging) return;
    const pick = viewer.scene.pick(movement.endPosition);
    const overPoint =
      pick &&
      pick.id &&
      Array.isArray(ch.points) &&
      ch.points.includes(pick.id);
    _setCursor(viewer.scene.canvas, overPoint ? "grab" : "default");
  }, ScreenSpaceEventType.MOUSE_MOVE);

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

  handler.setInputAction((move) => {
    if (!_state.dragging) return;

    const ellipsoid = viewer.scene.globe.ellipsoid;
    const cart = viewer.camera.pickEllipsoid(move.endPosition, ellipsoid);
    if (!cart) return;

    const idx = _state.dragIdx;

    const childPoint = ent.__children.points[idx];
    if (childPoint) childPoint.position = cart;

    const cur = _positionsForLine(ent, viewer).slice();
    cur[idx] = cart;
    _writePositionsForLine(ent, cur);

    _liveRefresh(ent, viewer);
    onAfterMutate?.();
  }, ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(() => {
    if (!_state.dragging) return;
    _state.dragging = false;
    _state.dragIdx = -1;
    _restoreCamera(viewer.scene);
    _setCursor(viewer.scene.canvas, "grab");
    _liveRefresh(ent, viewer);
    onAfterMutate?.();
  }, ScreenSpaceEventType.LEFT_UP);
}

export function stopEdit() {
  const v = _state.viewer;
  if (_state.handler) {
    try {
      _state.handler.destroy();
    } catch {}
    _state.handler = null;
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
