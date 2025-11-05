// src/components/Tools/AddMarker/markersDraft.js
import { Color } from "cesium";

export const defaultMarkerDraft = {
  color: "#ff3b30",        // fill color
  size: 10,                // pixelSize
  outlineColor: "#ffffff", // border color
  outlineWidth: 2,         // border width
};

export function toCesiumColor(css) {
  return Color.fromCssColorString(css);
}

function safeGetValue(prop) {
  return prop?.getValue ? prop.getValue() : prop;
}

function cssFromCesiumColor(col) {
  try {
    if (!col) return null;
    // col might already be a Cesium.Color instance
    return Color.toCssColorString(col);
  } catch {
    return null;
  }
}

export function draftFromMarkerEntity(ent) {
  // Prefer persisted draft
  if (ent.__draft) return { ...ent.__draft };

  // Fallback: read what we can from the entity’s current graphics
  const point = ent.point;
  const size =
    safeGetValue(point?.pixelSize) ??
    defaultMarkerDraft.size;

  const fillCss =
    cssFromCesiumColor(safeGetValue(point?.color)) ??
    defaultMarkerDraft.color;

  const outlineCss =
    cssFromCesiumColor(safeGetValue(point?.outlineColor)) ??
    defaultMarkerDraft.outlineColor;

  const outlineWidth =
    safeGetValue(point?.outlineWidth) ??
    defaultMarkerDraft.outlineWidth;

  return {
    color: fillCss,
    size,
    outlineColor: outlineCss,
    outlineWidth,
  };
}

export function applyDraftToMarkerEntity(ent, draft) {
  // Persist draft for future edits
  ent.__draft = { ...draft };

  const g = ent.point;
  if (g) {
    g.pixelSize = draft.size;
    g.color = toCesiumColor(draft.color);

    // border
    g.outlineColor = toCesiumColor(draft.outlineColor);
    g.outlineWidth = draft.outlineWidth;
  }

  ent.lastUpdated = new Date().toISOString();
}
