// src/components/Tools/DrawLines/linesDraft.js
import {
  Color,
  PolylineDashMaterialProperty,
  PolylineOutlineMaterialProperty,
  Cartesian3,
  Cartographic,
  EllipsoidGeodesic,
  Cartesian2,
  LabelStyle,
  JulianDate,
  ColorMaterialProperty
} from "cesium";

// ---------- Draft & helpers ----------

export const defaultLineDraft = {
  lineColor: "#ff3b30",
  lineWidth: 3,
  lineType: "solid", // 'solid' | 'dotted'
  pointColor: "#0066ff",
  pointSize: 8,
  showValues: true, // labels visible (segment + total)
};

export function formatMeters(m) {
  if (!isFinite(m)) return "";
  if (m >= 1000) return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
  return `${m.toFixed(m < 10 ? 2 : 1)} m`;
}

export function materialFromDraft(draft) {
  const color = Color.fromCssColorString(draft.lineColor);

  if (draft.lineType === "dotted") {
    return new PolylineDashMaterialProperty({
      color,
      dashPattern: parseInt("1111000011110000", 2),
    });
  }
  return new ColorMaterialProperty(color);
}


export function pointGraphicsFromDraft(draft) {
  return {
    pixelSize: draft.pointSize,
    color: Color.fromCssColorString(draft.pointColor),
    outlineColor: Color.WHITE,
    outlineWidth: Math.max(1, Math.round(draft.pointSize / 5)),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  };
}

// Robustly fetch positions now; works with arrays or Property
function getPositionsNow(ent, viewer) {
  const pos = ent?.polyline?.positions;
  if (!pos) return [];
  if (Array.isArray(pos)) return pos;

  if (typeof pos.getValue === "function") {
    const time =
      viewer?.clock?.currentTime ||
      (typeof JulianDate !== "undefined" ? JulianDate.now() : undefined);
    try {
      const v = pos.getValue(time);
      return Array.isArray(v) ? v : v ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function segmentInfo(p0, p1, ellipsoid) {
  const c0 = Cartographic.fromCartesian(p0, ellipsoid);
  const c1 = Cartographic.fromCartesian(p1, ellipsoid);
  const g = new EllipsoidGeodesic(c0, c1);
  const meters = g.surfaceDistance;

  // mid point for placing label
  const midLon = (c0.longitude + c1.longitude) / 2;
  const midLat = (c0.latitude + c1.latitude) / 2;
  const mid = Cartesian3.fromRadians(midLon, midLat, 0, ellipsoid);
  return { meters, mid };
}

// ---------- Label builders ----------

// Remove an entity safely
function safeRemove(v, ent) {
  if (!v || !ent) return;
  try {
    v.entities.remove(ent);
  } catch (_) {}
}

// Build (or rebuild) labels for each committed segment
export function rebuildCommittedLabels(ent, viewer) {
  if (!ent) return;
  const v = viewer;
  const scene = v?.scene;
  const ellipsoid = scene?.globe?.ellipsoid;
  if (!ellipsoid) return;

  // Clear existing per-segment labels
  const ch = (ent.__children ||= {});
  if (Array.isArray(ch.labels)) {
    for (const l of ch.labels) safeRemove(v, l);
  }
  ch.labels = [];

  const positions = getPositionsNow(ent, v);
  if (positions.length < 2) {
    ent.__children = ch;
    return;
  }

  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i];
    const b = positions[i + 1];
    const { meters, mid } = segmentInfo(a, b, ellipsoid);
    const label = v.entities.add({
      position: mid,
      label: {
        text: formatMeters(meters),
        font: "14px Barlow",
        style: LabelStyle.FILL_AND_OUTLINE,
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
        pixelOffset: new Cartesian2(0, -10),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      show: true,
    });
    label.__parent = ent;
    ch.labels.push(label);
  }

  ent.__children = ch;
}

// Show or update the total-length label at the end of the line
export function upsertTotalLengthLabel(ent, viewer) {
  if (!ent) return;
  const v = viewer;
  const scene = v?.scene;
  const ellipsoid = scene?.globe?.ellipsoid;

  const ch = (ent.__children ||= {});
  const positions = getPositionsNow(ent, v);

  // Compute total
  let total = 0;
  if (positions.length >= 2 && ellipsoid) {
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i];
      const b = positions[i + 1];
      total += segmentInfo(a, b, ellipsoid).meters;
    }
  }

  // Place near last vertex if available
  const last = positions[positions.length - 1];
  if (!last || !isFinite(total) || total <= 0) {
    // if a label already exists, hide it when no meaningful total
    if (ch.totalLabel) ch.totalLabel.show = false;
    ent.__children = ch;
    return;
  }

  if (!ch.totalLabel) {
    ch.totalLabel = v?.entities.add({
      position: last,
      label: {
        text: "Total längd:" + formatMeters(total),
        font: "14px Barlow",
        style: LabelStyle.FILL_AND_OUTLINE,
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
        pixelOffset: new Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      show: true,
    });
    if (ch.totalLabel) ch.totalLabel.__parent = ent;
  } else {
    ch.totalLabel.position = last;
    ch.totalLabel.label.text = formatMeters(total);
    ch.totalLabel.show = true;
  }

  ent.__children = ch;
}

// ---------- Apply draft to existing line ----------

export function draftFromLineEntity(ent) {
  const width = ent?.polyline?.width ?? 3;
  const saved = ent?.__draft;
  return saved
    ? { ...saved, lineWidth: width }
    : {
        lineColor: "#ff3b30",
        lineWidth: width,
        lineType: "solid",
        pointColor: "#0066ff",
        pointSize: 8,
        showValues: !!ent?.__children?.labels?.length || !!ent?.__children?.totalLabel,
      };
}

/**
 * Apply draft to:
 *  - polyline material/width
 *  - junction points style
 *  - (re)build per-segment labels & total label if showValues=true,
 *    otherwise hide them all
 *
 * viewer is optional; labels will still update if positions are arrays.
 */
export function applyDraftToLineEntity(ent, draft, viewer) {
  if (!ent) return;
  // Persist draft for future edits
  ent.__draft = { ...draft };

  // Update polyline style
  if (ent.polyline) {
    ent.polyline.material = materialFromDraft(draft);
    ent.polyline.width = draft.lineWidth;
  }

  // Update junction points
  const pts = ent.__children?.points || [];
  const g = pointGraphicsFromDraft(draft);
  for (const p of pts) {
    if (!p?.point) continue;
    p.point.pixelSize = g.pixelSize;
    p.point.color = g.color;
    p.point.outlineColor = g.outlineColor;
    p.point.outlineWidth = g.outlineWidth;
    p.point.disableDepthTestDistance = g.disableDepthTestDistance;
  }

  // Labels
  const ch = (ent.__children ||= {});
  const want = !!draft.showValues;

  if (!want) {
    // Hide all labels (do not remove, so we can re-enable quickly)
    if (Array.isArray(ch.labels)) {
      for (const l of ch.labels) if (l) l.show = false;
    }
    if (ch.totalLabel) ch.totalLabel.show = false;
  } else {
    // Rebuild segment labels from current positions
    rebuildCommittedLabels(ent, viewer);
    // Upsert total label
    upsertTotalLengthLabel(ent, viewer);
    // Ensure visibility
    if (Array.isArray(ch.labels)) {
      for (const l of ch.labels) if (l) l.show = true;
    }
    if (ch.totalLabel) ch.totalLabel.show = true;
  }

  ent.lastUpdated = new Date().toISOString();
}
