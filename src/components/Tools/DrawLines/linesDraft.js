// src/components/Tools/DrawLines/linesDraft.js
import {
  Color,
  Cartographic,
  EllipsoidGeodesic,
  Cartesian3,
  Cartesian2,
  PolylineDashMaterialProperty,
  HeightReference,
} from "cesium";

// -------------------- Draft + styling helpers --------------------

export const defaultLineDraft = {
  lineColor: "#ff3b30",
  lineWidth: 3,
  lineType: "solid", // 'solid' | 'dotted'
  pointColor: "#0066ff",
  pointSize: 8,
  showValues: false, // per-segment labels
  showTotalLabel: false, // total length label at end
  showPoints: true,
};

export function toCesiumColor(css) {
  return Color.fromCssColorString(css);
}

export function materialFromDraft(draft) {
  const color = toCesiumColor(draft.lineColor);
  if (draft.lineType === "dotted") {
    return new PolylineDashMaterialProperty({
      color,
      dashPattern: parseInt("1111000011110000", 2),
    });
  }
  return color;
}

export function pointGraphicsFromDraft(draft) {
  return {
    pixelSize: draft.pointSize,
    color: toCesiumColor(draft.pointColor),
    outlineColor: Color.WHITE,
    outlineWidth: Math.max(1, Math.round(draft.pointSize / 5)),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    heightReference: HeightReference.NONE,
  };
}

// -------------------- Distance + labels helpers --------------------

export function formatMeters(m) {
  if (!isFinite(m)) return "";
  if (m >= 1000) return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`;
  return `${m.toFixed(m < 10 ? 2 : 1)} m`;
}

export function segmentInfo(p0, p1, ellipsoid) {
  const c0 = Cartographic.fromCartesian(p0, ellipsoid);
  const c1 = Cartographic.fromCartesian(p1, ellipsoid);
  const g = new EllipsoidGeodesic(c0, c1);
  const meters = g.surfaceDistance;

  const midLon = (c0.longitude + c1.longitude) / 2;
  const midLat = (c0.latitude + c1.latitude) / 2;
  const mid = Cartesian3.fromRadians(midLon, midLat, 0, ellipsoid);

  return { meters, mid };
}

function segmentMeters(p0, p1, ellipsoid) {
  const c0 = Cartographic.fromCartesian(p0, ellipsoid);
  const c1 = Cartographic.fromCartesian(p1, ellipsoid);
  const g = new EllipsoidGeodesic(c0, c1);
  return g.surfaceDistance;
}

// -------------------- Public rebuilders used by drawing + edit --------------------

export function rebuildSegmentLabels(ent, viewer) {
  const v = viewer;
  if (!v || !ent) return;

  const ch = (ent.__children ||= {});
  if (Array.isArray(ch.labels)) {
    for (const l of ch.labels) v.entities.remove(l);
  }
  ch.labels = [];

  if (!ent.__draft?.showValues) {
    ent.__children = ch;
    return;
  }

  const positions = getLinePositions(ent, v);
  if (!positions || positions.length < 2) {
    ent.__children = ch;
    return;
  }

  const ellipsoid = v.scene.globe.ellipsoid;
  for (let i = 0; i < positions.length - 1; i++) {
    const { meters, mid } = segmentInfo(
      positions[i],
      positions[i + 1],
      ellipsoid
    );
    const label = v.entities.add({
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
      },
      show: true,
    });
    label.__parent = ent;
    ch.labels.push(label);
  }

  ent.__children = ch;
}

export { rebuildSegmentLabels as rebuildCommittedLabels };

// ✅ total label respects showTotalLabel (independent of showValues)
export function upsertTotalLengthLabel(ent, viewer) {
  if (!viewer || !viewer.scene || !ent?.polyline) return;

  const showTotal = ent.__draft?.showTotalLabel ?? true;

  const time = viewer.clock.currentTime;
  const posProp = ent.polyline?.positions;
  const positions = Array.isArray(posProp)
    ? posProp
    : posProp?.getValue
    ? posProp.getValue(time) || []
    : [];

  if (!Array.isArray(positions) || positions.length < 2) {
    if (ent.__children?.totalLabel) {
      ent.__children.totalLabel.show = false;
    }
    return;
  }

  const ellipsoid = viewer.scene.globe.ellipsoid;
  let totalMeters = 0;
  for (let i = 1; i < positions.length; i++) {
    totalMeters += segmentMeters(positions[i - 1], positions[i], ellipsoid);
  }

  const last = positions[positions.length - 1];

  const ch = (ent.__children ||= {});
  const text = `Total längd: ${formatMeters(totalMeters)}`;

  if (!ch.totalLabel) {
    ch.totalLabel = viewer.entities.add({
      position: last,
      label: {
        text,
        font: "14px Barlow",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
        pixelOffset: new Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      show: !!showTotal,
    });
    ch.totalLabel.__parent = ent;
  } else {
    ch.totalLabel.position = last;
    ch.totalLabel.label.text = text;
    ch.totalLabel.show = !!showTotal;
  }

  ent.__children = ch;
}

// ✅ ONLY toggles segment labels (showValues). Does NOT touch total.
export function setLineLabelsVisibility(ent, visible, viewer) {
  const ch = (ent.__children ||= {});
  ent.__draft = { ...(ent.__draft || {}), showValues: !!visible };

  if (!visible) {
    if (Array.isArray(ch.labels)) for (const l of ch.labels) l.show = false;
    return;
  }

  rebuildSegmentLabels(ent, viewer);
  if (Array.isArray(ch.labels)) for (const l of ch.labels) l.show = true;
}

// -------------------- Creation-time helpers --------------------

export function draftFromLineEntity(ent) {
  const width = ent.polyline?.width?.getValue?.() ?? ent.polyline?.width ?? 3;
  const saved = ent.__draft;
  return saved
    ? { ...saved, lineWidth: width }
    : {
        ...defaultLineDraft,
        lineWidth: width,
        showValues: !!ent.__children?.labels?.length,
        showTotalLabel: !!ent.__children?.totalLabel,
        showPoints: !!ent.__children?.points?.length,
      };
}

export function applyDraftToLineEntity(ent, draft, viewer) {
  ent.__draft = { ...draft };

  // main line
  ent.polyline.material = materialFromDraft(draft);
  ent.polyline.width = draft.lineWidth;

  // points
  const pts = ent.__children?.points || [];
  for (const p of pts) {
    const g = pointGraphicsFromDraft(draft);
    p.point.pixelSize = g.pixelSize;
    p.point.color = g.color;
    p.point.outlineColor = g.outlineColor;
    p.point.outlineWidth = g.outlineWidth;
    p.point.disableDepthTestDistance = g.disableDepthTestDistance;
    p.point.heightReference = HeightReference.NONE;
    p.show = !!draft.showPoints;
  }

  // segment labels
  if (!draft.showValues) {
    if (ent.__children?.labels) {
      for (const l of ent.__children.labels) viewer?.entities.remove(l);
      ent.__children.labels = [];
    }
  } else {
    rebuildSegmentLabels(ent, viewer);
    if (Array.isArray(ent.__children?.labels)) {
      for (const l of ent.__children.labels) l.show = true;
    }
  }

  // total label
  if (!draft.showTotalLabel) {
    if (ent.__children?.totalLabel) {
      viewer?.entities.remove(ent.__children.totalLabel);
      ent.__children.totalLabel = null;
    }
  } else {
    upsertTotalLengthLabel(ent, viewer);
    if (ent.__children?.totalLabel) ent.__children.totalLabel.show = true;
  }

  ent.lastUpdated = new Date().toISOString();
}

// -------------------- Restore helpers used when toggling show --------------------

/**
 * Get static positions array for a finished line.
 * Prefer live polyline positions; fall back to ent.__positions snapshot.
 */
function getLinePositions(ent, viewer) {
  const posProp = ent.polyline?.positions;

  if (posProp) {
    try {
      const val = posProp.getValue
        ? posProp.getValue(viewer?.clock?.currentTime)
        : posProp;
      if (Array.isArray(val) && val.length) return val;
    } catch {}
  }

  if (Array.isArray(ent.__positions) && ent.__positions.length) {
    return ent.__positions;
  }

  return null;
}

/**
 * Rebuild junction point entities from the line's positions.
 * (This replaces the nonexistent rebuildOrCreateJunctionPoints you don’t have.)
 */
function rebuildJunctionPointsFromPositions(ent, viewer) {
  if (!ent || !viewer) return;

  const positions = getLinePositions(ent, viewer);
  if (!Array.isArray(positions) || positions.length === 0) return;

  const ch = (ent.__children ||= {});

  // Remove old points if any
  if (Array.isArray(ch.points)) {
    for (const p of ch.points) {
      try {
        if (p) viewer.entities.remove(p);
      } catch {}
    }
  }
  ch.points = [];

  const g = pointGraphicsFromDraft(ent.__draft || defaultLineDraft);
  const showPts = !!(ent.__draft?.showPoints ?? true);

  for (const pos of positions) {
    const pointEnt = viewer.entities.add({
      position: pos,
      point: g,
      show: showPts,
    });
    pointEnt.__parent = ent;
    ch.points.push(pointEnt);
  }

  ent.__children = ch;
}

/**
 * Recreate missing child entities (points + labels) based on saved positions + draft.
 * Call this when restoring a hidden line, in case child entities were never created
 * or were previously removed.
 */
export function rehydrateLineChildrenIfMissing(ent, viewer) {
  const ch = (ent.__children ||= {});
  const wantSeg = !!ent.__draft?.showValues;
  const wantTotal = ent.__draft?.showTotalLabel ?? true;

  // Points
  if (!Array.isArray(ch.points) || ch.points.length === 0) {
    rebuildJunctionPointsFromPositions(ent, viewer);
  }

  // Segment labels
  if (wantSeg && (!Array.isArray(ch.labels) || ch.labels.length === 0)) {
    rebuildSegmentLabels(ent, viewer);
  }

  // Total label (will show/hide based on showTotalLabel)
  upsertTotalLengthLabel(ent, viewer);

  // Apply visibility
  if (Array.isArray(ch.labels)) for (const l of ch.labels) l.show = wantSeg;
  if (ch.totalLabel) ch.totalLabel.show = !!wantTotal;

  ent.__children = ch;
}

/**
 * Toggle visibility of a line and its child entities according to draft.
 * If making visible, we also rehydrate missing children.
 */
export function setLineVisibility(ent, show, viewer) {
  ent.show = !!show;
  ent.isActive = !!show;
  ent.lastUpdated = new Date().toISOString();

  const ch = (ent.__children ||= {});

  if (show) {
    rehydrateLineChildrenIfMissing(ent, viewer);

    if (Array.isArray(ch.points))
      for (const p of ch.points) p.show = !!ent.__draft?.showPoints;
    if (Array.isArray(ch.labels))
      for (const l of ch.labels) l.show = !!ent.__draft?.showValues;
    if (ch.totalLabel)
      ch.totalLabel.show = !!(ent.__draft?.showTotalLabel ?? true);
  } else {
    if (Array.isArray(ch.points)) for (const p of ch.points) p.show = false;
    if (Array.isArray(ch.labels)) for (const l of ch.labels) l.show = false;
    if (ch.totalLabel) ch.totalLabel.show = false;
  }
}
