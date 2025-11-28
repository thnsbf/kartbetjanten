// src/components/Tools/DrawArea/areaDraft.js
import {
  Color,
  Cartographic,
  EllipsoidGeodesic,
  PolygonHierarchy,
  Cartesian3,
  Cartesian2,
  Matrix4,
  Transforms,
  HeightReference,
} from "cesium";

export const defaultAreaDraft = {
  pointColor: "#0066ff",
  pointSize: 8,
  // old: fillColor: "rgba(255, 59, 48, 0.25)",
  fillHex: "#ff3b30", // NEW: pure color
  fillOpacity: 0.25, // NEW: opacity 0..1
  outlineColor: "#ff3b30",
  outlineWidth: 2,
  showAreaLabel: true,
  showPoints: false,
  showEdgeValues: true,
};

// ---------- small utils ----------
function _getPolygonPositions(ent, viewer) {
  try {
    const h = ent?.polygon?.hierarchy;
    const t = viewer?.clock?.currentTime;
    const val = h?.getValue ? h.getValue(t) : h;
    if (!val) return [];
    if (val.positions) return val.positions;
    if (Array.isArray(val)) return val;
  } catch {}
  return [];
}

function _sweepChildrenByParent(viewer, ent, predicate) {
  if (!viewer?.entities || !ent) return;
  const arr = viewer.entities.values || [];
  for (const e of arr) {
    if (!e) continue;
    try {
      if (e.__parent === ent && (!predicate || predicate(e))) {
        viewer.entities.remove(e);
      }
    } catch {}
  }
}

function _forceRebuildCenterLabel(ent, viewer, visible) {
  if (!ent) return;
  if (!ent.__children) ent.__children = {};
  const ch = ent.__children;

  // Always remove any existing center label references
  if (ch.label && viewer?.entities) {
    try {
      viewer.entities.remove(ch.label);
    } catch {}
  }
  ch.label = null;

  // Also sweep any stray center labels that still reference this entity
  _sweepChildrenByParent(viewer, ent, (e) => e.__kind === "area-center");

  if (!visible) return;
  // Need a valid viewer + ellipsoid to rebuild
  const ellipsoid = viewer?.scene?.globe?.ellipsoid;
  if (!viewer?.entities || !ellipsoid) return;

  const positions = _getPolygonPositions(ent, viewer);
  if (positions.length < 3) return;

  const center = polygonCentroid(positions, ellipsoid);
  const area = polygonAreaMeters2(positions, ellipsoid);

  const lbl = viewer.entities.add({
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
  if (lbl) {
    lbl.__parent = ent;
    lbl.__kind = "area-center"; // <-- tag for robust future removal
    ch.label = lbl;
  }
}

function _forceRebuildEdgeLabels(ent, viewer, visible) {
  if (!ent) return;
  if (!ent.__children) ent.__children = {};
  const ch = ent.__children;

  // Always remove any existing edge labels we know about
  if (Array.isArray(ch.edgeLabels) && viewer?.entities) {
    for (const l of ch.edgeLabels) {
      try {
        viewer.entities.remove(l);
      } catch {}
    }
  }
  ch.edgeLabels = [];

  // Also sweep any stray edge labels that still reference this entity
  _sweepChildrenByParent(viewer, ent, (e) => e.__kind === "area-edge");

  if (!visible) return;
  // Need a valid viewer + ellipsoid to rebuild
  const ellipsoid = viewer?.scene?.globe?.ellipsoid;
  if (!viewer?.entities || !ellipsoid) return;

  const positions = _getPolygonPositions(ent, viewer);
  if (positions.length < 2) return;

  for (let i = 0; i < positions.length; i++) {
    const p0 = positions[i];
    const p1 = positions[(i + 1) % positions.length];
    const { meters, mid } = segmentInfo(p0, p1, ellipsoid);

    const label = viewer.entities.add({
      position: mid,
      label: {
        text: formatMeters(meters),
        font: "14px Barlow",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
        pixelOffset: new Cartesian2(0, -8),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: HeightReference.NONE,
      },
      show: true,
    });
    if (label) {
      label.__parent = ent;
      label.__kind = "area-edge"; // <-- tag for robust future removal
      ch.edgeLabels.push(label);
    }
  }
}

export function setAreaVisibility(ent, visible, viewer) {
  if (!ent) return;
  if (!ent.__children) ent.__children = {};
  const ch = ent.__children;
  const draft = ent.__draft || {};

  // Polygon itself
  ent.show = !!visible;

  // Points: only show when entity is visible AND draft says to
  if (Array.isArray(ch.points)) {
    const want = !!visible && !!draft.showPoints;
    for (const p of ch.points) {
      if (p) p.show = want;
    }
  }

  // Center label
  if (ch.label) {
    ch.label.show = !!visible && !!draft.showAreaLabel;
  }

  // Edge-length labels
  if (Array.isArray(ch.edgeLabels)) {
    const want = !!visible && !!draft.showEdgeValues;
    for (const l of ch.edgeLabels) {
      if (l) l.show = want;
    }
  }
}

export function ensureAreaDraftShape(d) {
  const out = { ...defaultAreaDraft, ...(d || {}) };
  if (!("fillHex" in out) || !("fillOpacity" in out)) {
    // Try to parse old rgba(..) fillColor if present
    if (out.fillColor && typeof out.fillColor === "string") {
      const m = out.fillColor.match(/rgba?\(([^)]+)\)/i);
      if (m) {
        const parts = m[1].split(",").map((x) => x.trim());
        const [r, g, b, a = "1"] = parts;
        const toHex = (n) => {
          const v = Math.max(0, Math.min(255, Number(n)));
          return v.toString(16).padStart(2, "0");
        };
        out.fillHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        out.fillOpacity = Math.max(0, Math.min(1, Number(a)));
      } else {
        // fallback if couldn't parse
        out.fillHex = out.fillHex || "#ff3b30";
        out.fillOpacity = out.fillOpacity ?? 0.25;
      }
    } else {
      out.fillHex = out.fillHex || "#ff3b30";
      out.fillOpacity = out.fillOpacity ?? 0.25;
    }
  }
  return out;
}

export function cesiumFillFromDraft(d) {
  // Combine hex + opacity for Cesium
  const hex = d.fillHex || "#ff3b30";
  const a = typeof d.fillOpacity === "number" ? d.fillOpacity : 1;
  const base = Color.fromCssColorString(hex);
  return Color.fromAlpha(base, a);
}

function _ensureChildren(ent) {
  if (!ent.__children) ent.__children = {};
  const ch = ent.__children;
  if (!Array.isArray(ch.points)) ch.points = [];
  if (!Array.isArray(ch.edgeLabels)) ch.edgeLabels = [];
  // ch.label may be null or an Entity
  if (!ch.temp) ch.temp = {};
  return ch;
}

function _safeRemove(viewer, entity) {
  if (!entity) return;
  if (viewer && viewer.entities) {
    try {
      viewer.entities.remove(entity);
    } catch {}
  } else {
    // Fallback if no viewer: just hide, so we don't throw
    try {
      entity.show = false;
    } catch {}
  }
}

export function formatMeters(m) {
  if (!isFinite(m)) return "";
  if (m >= 1000) return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
  return `${m.toFixed(m < 10 ? 2 : 1)} m`;
}

export function formatSquareMeters(m2) {
  if (!isFinite(m2)) return "";
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
  if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(1)} ha`;
  // For smaller areas, show whole meters squared (no "k m²")
  return `${Math.round(m2)} m²`;
}

function parseCssAlpha(css) {
  // returns alpha if rgba(..., a) else undefined
  const m = /^rgba?\(\s*\d+,\s*\d+,\s*\d+(?:,\s*([0-9.]+))?\s*\)$/.exec(
    css || ""
  );
  if (m && m[1] != null) {
    const a = parseFloat(m[1]);
    if (isFinite(a)) return Math.max(0, Math.min(1, a));
  }
  return undefined;
}

function colorWithAlpha(css, fallbackAlpha = 1) {
  const base = Color.fromCssColorString(css);
  const a = parseCssAlpha(css);
  return Color.fromAlpha(base, a ?? fallbackAlpha);
}

/** label for a single edge: distance + midpoint on ellipsoid */
function segmentInfo(p0, p1, ellipsoid) {
  const c0 = Cartographic.fromCartesian(p0, ellipsoid);
  const c1 = Cartographic.fromCartesian(p1, ellipsoid);
  const g = new EllipsoidGeodesic(c0, c1);
  const meters = g.surfaceDistance;

  const midLon = (c0.longitude + c1.longitude) / 2;
  const midLat = (c0.latitude + c1.latitude) / 2;
  const mid = Cartesian3.fromRadians(midLon, midLat, 0, ellipsoid);

  return { meters, mid };
}

/** basic point graphics for polygon vertices */
export function pointGraphicsFromDraft(draft) {
  return {
    pixelSize: draft.pointSize ?? 8,
    color: Color.fromCssColorString(draft.pointColor ?? "#0066ff"),
    outlineColor: Color.WHITE,
    outlineWidth: Math.max(1, Math.round((draft.pointSize ?? 8) / 5)),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    heightReference: HeightReference.NONE,
  };
}

// ---------- area geometry helpers ----------

/**
 * Compute polygon area in m² by projecting to a local ENU plane and
 * applying the 2D shoelace formula. Positions are Cartesian3[] on the ellipsoid.
 */
export function polygonAreaMeters2(positions, ellipsoid) {
  const pts = positions || [];
  const n = pts.length;
  if (n < 3) return 0;

  // ENU frame at rough center (average of cartesian vertices)
  const avg = new Cartesian3(
    pts.reduce((s, p) => s + p.x, 0) / n,
    pts.reduce((s, p) => s + p.y, 0) / n,
    pts.reduce((s, p) => s + p.z, 0) / n
  );
  const enu = Transforms.eastNorthUpToFixedFrame(avg, ellipsoid);
  const invEnu = Matrix4.inverse(enu, new Matrix4());

  // Map to 2D ENU (east=x, north=y)
  const xy = pts.map((p) => {
    const lp = Matrix4.multiplyByPoint(invEnu, p, new Cartesian3());
    return { x: lp.x, y: lp.y };
  });

  // Shoelace area
  let area2 = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area2 += xy[j].x * xy[i].y - xy[i].x * xy[j].y;
  }
  return Math.abs(area2) * 0.5;
}

/**
 * Polygon centroid in world Cartesian3 by computing 2D centroid in ENU and
 * transforming back. Falls back to simple average if degenerate.
 */
export function polygonCentroid(positions, ellipsoid) {
  const pts = positions || [];
  const n = pts.length;
  if (n === 0) return Cartesian3.ZERO;
  if (n === 1) return pts[0];

  const avg = new Cartesian3(
    pts.reduce((s, p) => s + p.x, 0) / n,
    pts.reduce((s, p) => s + p.y, 0) / n,
    pts.reduce((s, p) => s + p.z, 0) / n
  );
  const enu = Transforms.eastNorthUpToFixedFrame(avg, ellipsoid);
  const invEnu = Matrix4.inverse(enu, new Matrix4());

  const xy = pts.map((p) => {
    const lp = Matrix4.multiplyByPoint(invEnu, p, new Cartesian3());
    return { x: lp.x, y: lp.y };
  });

  // Shoelace centroid (2D)
  let a = 0,
    cx = 0,
    cy = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const cross = xy[j].x * xy[i].y - xy[i].x * xy[j].y;
    a += cross;
    cx += (xy[j].x + xy[i].x) * cross;
    cy += (xy[j].y + xy[i].y) * cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    // Degenerate; return average
    return avg;
  }
  cx /= 6 * a;
  cy /= 6 * a;

  // Back to world space (z=0 in local plane)
  const localCentroid = new Cartesian3(cx, cy, 0);
  const world = Matrix4.multiplyByPoint(enu, localCentroid, new Cartesian3());

  // Snap to ellipsoid surface height 0 for label stability
  const carto = Cartographic.fromCartesian(world, ellipsoid);
  carto.height = 0;
  return Cartesian3.fromRadians(carto.longitude, carto.latitude, 0, ellipsoid);
}

// ---------- center area label ----------

export function rebuildAreaLabel(ent, viewer) {
  const scene = viewer.scene;
  const ellipsoid = scene.globe.ellipsoid;
  const time = viewer.clock.currentTime;

  const h = ent.polygon.hierarchy;
  const val = h?.getValue ? h.getValue(time) : h;
  const positions =
    val instanceof PolygonHierarchy
      ? val.positions ?? []
      : Array.isArray(val)
      ? val
      : [];

  const ch = (ent.__children ||= {});
  // remove old
  if (ch.label) {
    viewer.entities.remove(ch.label);
    ch.label = null;
  }
  if (!ent.__draft?.showAreaLabel || positions.length < 3) {
    ent.__children = ch;
    return;
  }

  const center = polygonCentroid(positions, ellipsoid);
  const area = polygonAreaMeters2(positions, ellipsoid);

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
      pixelOffset: new Cartesian2(0, -12),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: HeightReference.NONE,
    },
    show: true,
  });
  label.__parent = ent;
  ch.label = label;

  ent.__children = ch;
}

// ---------- edge-length labels ----------

/**
 * Rebuild one label per edge of the polygon.
 * Stores them at ent.__children.edgeLabels
 * If ent.__draft.showEdgeValues === false, removes any existing edge labels.
 */
export function rebuildAreaEdgeLabels(ent, viewer) {
  const scene = viewer.scene;
  const ellipsoid = scene.globe.ellipsoid;
  const time = viewer.clock.currentTime;

  const ch = (ent.__children ||= {});
  // remove old
  if (Array.isArray(ch.edgeLabels)) {
    for (const l of ch.edgeLabels) viewer.entities.remove(l);
  }
  ch.edgeLabels = [];

  if (!ent.__draft?.showEdgeValues) {
    ent.__children = ch;
    return;
  }

  // read polygon positions
  const h = ent.polygon.hierarchy;
  const val = h?.getValue ? h.getValue(time) : h;
  const positions =
    val instanceof PolygonHierarchy
      ? val.positions ?? []
      : Array.isArray(val)
      ? val
      : [];

  if (positions.length < 2) {
    ent.__children = ch;
    return;
  }

  // make a label for each edge (wrap last→first)
  for (let i = 0; i < positions.length; i++) {
    const p0 = positions[i];
    const p1 = positions[(i + 1) % positions.length];

    const { meters, mid } = segmentInfo(p0, p1, ellipsoid);
    const label = viewer.entities.add({
      position: mid,
      label: {
        text: formatMeters(meters),
        font: "14px Barlow",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
        pixelOffset: new Cartesian2(0, -8), // small “above” offset
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: HeightReference.NONE,
      },
      show: true,
    });
    label.__parent = ent;
    ch.edgeLabels.push(label);
  }

  ent.__children = ch;
}

/**
 * Toggle edge labels visibility from the modal.
 */
export function setAreaEdgeLabelsVisible(ent, visible, viewer) {
  const ch = (ent.__children ||= {});
  if (!visible) {
    if (Array.isArray(ch.edgeLabels)) {
      for (const l of ch.edgeLabels) viewer.entities.remove(l);
    }
    ch.edgeLabels = [];
  } else {
    rebuildAreaEdgeLabels(ent, viewer);
  }
  ent.__children = ch;
}

export function draftFromAreaEntity(ent) {
  // If we stored the draft when the polygon was created/last edited, prefer that.
  if (ent.__draft) {
    return { ...defaultAreaDraft, ...ent.__draft };
  }

  // Fallback: infer from current entity graphics
  const ch = ent.__children || {};
  const samplePoint =
    Array.isArray(ch.points) && ch.points.length ? ch.points[0].point : null;

  const pointSize =
    (samplePoint &&
      typeof samplePoint.pixelSize === "number" &&
      samplePoint.pixelSize) ??
    defaultAreaDraft.pointSize;

  const pointColor =
    (samplePoint &&
      samplePoint.color &&
      (Color.toCssColorString?.(samplePoint.color) ||
        // Some Cesium builds expose .toCssColorString() on the instance too:
        (samplePoint.color.toCssColorString?.() ?? null))) ||
    defaultAreaDraft.pointColor;

  const outlineColor =
    (ent.polygon &&
      ent.polygon.outlineColor &&
      (Color.toCssColorString?.(ent.polygon.outlineColor) ||
        ent.polygon.outlineColor.toCssColorString?.())) ||
    defaultAreaDraft.outlineColor;

  const outlineWidth =
    (ent.polygon &&
      typeof ent.polygon.outlineWidth === "number" &&
      ent.polygon.outlineWidth) ??
    defaultAreaDraft.outlineWidth;

  // Visibility flags
  const showAreaLabel = !!ch.label;
  const showEdgeValues = !!(
    Array.isArray(ch.edgeLabels) && ch.edgeLabels.length
  );
  const showPoints = !!(
    Array.isArray(ch.points) && ch.points.some((p) => p.show)
  );

  // NOTE: inferring fillColor reliably requires evaluating the material property at a time,
  // which we avoid here to keep this util pure. We fall back to the default unless it was saved in __draft.
  // (If you really need actual fillColor, store it on ent.__draft during creation/edits.)
  const fillColor = defaultAreaDraft.fillColor;

  return {
    ...defaultAreaDraft,
    pointColor,
    pointSize,
    fillColor,
    outlineColor,
    outlineWidth,
    showAreaLabel,
    showPoints,
    showEdgeValues,
  };
}

// ---------- apply draft from AreaModal ----------

/**
 * Apply visual changes from AreaModal draft to an existing polygon entity.
 * - Updates fill, outline
 * - Shows/hides/updates center area label
 * - Shows/hides edge-length labels
 * - Updates vertex points styling + visibility
 */
export function applyDraftToAreaEntity(ent, draft, viewer) {
  if (!ent || !ent.polygon) return;

  const entities = viewer?.entities; // may be undefined — that's OK
  const ellipsoid = viewer?.scene?.globe?.ellipsoid; // may be undefined

  // Save latest draft
  ent.__draft = { ...draft };

  // Update polygon visual style (no viewer needed)
  try {
    const safe = ensureAreaDraftShape(draft);
    ent.__draft = safe; // keep the upgraded shape
    ent.polygon.material = cesiumFillFromDraft(safe);
    ent.polygon.outline = true;
    ent.polygon.outlineColor = Color.fromCssColorString(safe.outlineColor);
    ent.polygon.outlineWidth = safe.outlineWidth;
    ent.polygon.outline = true;
    ent.polygon.outlineColor = Color.fromCssColorString(draft.outlineColor);
    ent.polygon.outlineWidth = draft.outlineWidth;
  } catch {}

  // Ensure children map
  if (!ent.__children) ent.__children = {};
  const ch = ent.__children;
  if (!Array.isArray(ch.points)) ch.points = [];
  if (!Array.isArray(ch.edgeLabels)) ch.edgeLabels = [];

  // Update marker visuals + visibility (no viewer needed)
  if (Array.isArray(ch.points)) {
    const g = pointGraphicsFromDraft(draft);
    for (const p of ch.points) {
      if (!p?.point) continue;
      try {
        p.point.pixelSize = g.pixelSize;
        p.point.color = g.color;
        p.point.outlineColor = g.outlineColor;
        p.point.outlineWidth = g.outlineWidth;
        p.point.disableDepthTestDistance = g.disableDepthTestDistance;
        p.point.heightReference = HeightReference.NONE;
        p.show = !!draft.showPoints;
      } catch {}
    }
  }

  // --- Center label toggle ---
  if (ch.label) {
    if (!draft.showAreaLabel) {
      // Hide immediately (no viewer required)
      ch.label.show = false;
    } else {
      // Rebuild for correctness when we have a viewer; otherwise just show it
      if (entities?.contains?.(ch.label)) {
        try {
          entities.remove(ch.label);
        } catch {}
        _forceRebuildCenterLabel(ent, viewer, true);
      } else {
        ch.label.show = true; // fallback if no viewer
      }
    }
  } else if (draft.showAreaLabel) {
    // Build fresh if we have viewer; otherwise defer until next edit
    if (entities && ellipsoid) {
      _forceRebuildCenterLabel(ent, viewer, true);
    }
  }

  // --- Edge label toggle ---
  if (Array.isArray(ch.edgeLabels) && ch.edgeLabels.length) {
    if (!draft.showEdgeValues) {
      // Hide immediately (no viewer required)
      for (const l of ch.edgeLabels) if (l) l.show = false;
    } else {
      // Rebuild if we can; else just show existing
      if (entities) {
        for (const l of ch.edgeLabels) {
          if (entities.contains?.(l)) {
            try {
              entities.remove(l);
            } catch {}
          }
        }
        _forceRebuildEdgeLabels(ent, viewer, true);
      } else {
        for (const l of ch.edgeLabels) if (l) l.show = true;
      }
    }
  } else if (draft.showEdgeValues) {
    if (entities && ellipsoid) {
      _forceRebuildEdgeLabels(ent, viewer, true);
    }
  }

  ent.lastUpdated = new Date().toISOString();
  ent.isActive = true;
}
