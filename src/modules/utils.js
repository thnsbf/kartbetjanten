import { Cartesian3, Cartographic, Math as CesiumMath } from "cesium";

export async function arbitraryPause(ms = 5000) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, ms);
  });
}

export async function readJson(pathFromRoot) {
  // pathFromRoot like '/json/adresser.json'
  const res = await fetch(pathFromRoot);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${pathFromRoot}`);
  return res.json();
}

export function zoomToXY(viewer, lon, lat, height = 300) {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat, height),
    duration: 1.5, // seconds
  });
}

export function moveCameraHeight(viewer, delta = 100) {
  if (!viewer) return;
  const camera = viewer.camera;
  const carto = Cartographic.fromCartesian(camera.position);
  const newHeight = Math.max(1, carto.height + delta);
  const destination = Cartesian3.fromRadians(
    carto.longitude,
    carto.latitude,
    newHeight
  );
  camera.setView({
    destination,
    orientation: {
      heading: camera.heading,
      pitch: camera.pitch,
      roll: camera.roll,
    },
  });
}

export function zoomTo(viewer, lon, lat) {
  const { camera } = viewer
  camera.setView({
    orientation: {
      heading: camera.heading,        // keep current heading
      pitch: -CesiumMath.PI_OVER_TWO,        // -90° (top-down)
      roll: 0
    },
    destination: Cartesian3.fromDegrees(lon, lat, 327)
  });
}

// src/modules/entityChildren.js

// src/modules/entityChildren.js

/**
 * Toggle visibility for an entity "group": the parent entity plus child entities
 * under ent.__children (points, labels, edgeLabels, totalLabel, etc).
 * When restoring (visible === true), we respect ent.__draft flags.
 */
// src/modules/entityChildren.js

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function setArrayShow(arr, show) {
  if (!Array.isArray(arr)) return;
  for (const child of arr) {
    if (child && typeof child.show !== "undefined") child.show = !!show;
  }
}

function setOneShow(child, show) {
  if (child && typeof child.show !== "undefined") child.show = !!show;
}

/**
 * Toggle visibility for an entity and its children (points, labels, edgeLabels, etc).
 * When restoring (visible === true), we respect ent.__draft flags so UI checkboxes
 * stay in sync (lines: showValues; areas: showAreaLabel, showEdgeValues, showPoints).
 */
export function setEntityGroupVisibility(ent, visible) {
  if (!ent) return;

  const ch = ent.__children || {};
  const draft = ent.__draft || {};

  // Parent first
  ent.show = !!visible;
  ent.isActive = !!visible;

  if (!visible) {
    // HIDE EVERYTHING
    setArrayShow(ch.points, false);
    setArrayShow(ch.labels, false);
    setArrayShow(ch.edgeLabels, false);
    setOneShow(ch.totalLabel, false);
    setOneShow(ch.label, false);
    if (ch.temp) {
      setOneShow(ch.temp.label, false);
      setOneShow(ch.temp.poly, false);
    }
    return;
  }

  // RESTORE respecting draft flags.
  // Start with a conservative default (geometry visible, labels off) then apply flags.

  // Geometry-like children (points are geometry-ish for areas/lines)
  setArrayShow(ch.points, true);

  // Labels default hidden on restore
  setArrayShow(ch.labels, false);
  setArrayShow(ch.edgeLabels, false);
  setOneShow(ch.totalLabel, false);
  setOneShow(ch.label, false);

  if (ch.temp) {
    setOneShow(ch.temp.label, false);
    setOneShow(ch.temp.poly, false);
  }

  // LINE entity: control labels via showValues
  if (ent.polyline) {
    const showValues = hasOwn(draft, "showValues") ? !!draft.showValues : false;
    setArrayShow(ch.labels, showValues);
    setOneShow(ch.totalLabel, showValues);
    // points: leave visible unless you add a separate draft flag for them
  }

  // AREA entity: control points/center label/edge labels via three flags
  if (ent.polygon) {
    const showCenter = hasOwn(draft, "showAreaLabel") ? !!draft.showAreaLabel : false;
    const showEdges  = hasOwn(draft, "showEdgeValues") ? !!draft.showEdgeValues : false;
    const showPoints = hasOwn(draft, "showPoints")     ? !!draft.showPoints     : false;

    setOneShow(ch.label, showCenter);
    setArrayShow(ch.edgeLabels, showEdges);
    setArrayShow(ch.points, showPoints);
  }
}

/**
 * Remove an entire entity group from the viewer:
 * - removes child entities in ent.__children
 * - then removes the parent entity itself
 */
export function removeEntityGroup(ent, viewer) {
  if (!ent || !viewer) return;
  const ch = ent.__children || {};

  const removeArray = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const e of arr) if (e) viewer.entities.remove(e);
  };
  const removeOne = (e) => { if (e) viewer.entities.remove(e); };

  removeArray(ch.points);
  removeArray(ch.labels);
  removeArray(ch.edgeLabels);
  removeOne(ch.totalLabel);
  removeOne(ch.label);
  if (ch.temp) {
    removeOne(ch.temp.label);
    removeOne(ch.temp.poly);
  }

  viewer.entities.remove(ent);

  // Cleanup references (optional)
  if (ent.__children) {
    ent.__children.points = [];
    ent.__children.labels = [];
    ent.__children.edgeLabels = [];
    if (ent.__children.temp) {
      ent.__children.temp.label = null;
      ent.__children.temp.poly = null;
    }
    ent.__children.totalLabel = null;
    ent.__children.label = null;
  }
}
