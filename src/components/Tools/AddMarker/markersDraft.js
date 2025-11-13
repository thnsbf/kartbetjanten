// src/components/Tools/AddMarker/markersDraft.js
import {
  Color,
  BillboardGraphics,
  HorizontalOrigin,
  VerticalOrigin,
  PointGraphics,
} from "cesium";

export const defaultMarkerDraft = {
  size: 16, // used for point pixelSize OR billboard width/height
  color: "#ff3b30", // main color (also used to tint SVGs)
  outlineColor: "#ffffff", // only used for 'dot' point markers
  outlineWidth: 2, // only used for 'dot' point markers
  iconId: "dot", // 'dot' | 'pin' | 'flag' | 'star' (extend as you like)
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

// markersDraft.js (add near the top with your other exports)

const ICON_META = {
  default: { scale: 3 },
  pin: { scale: 3 },
  flag: { scale: 3 },
  star: { scale: 3 },
  toilet: { scale: 3 },
  outlet: { scale: 3 },
  borehole: { scale: 3 },
  water: { scale: 3 },
  sewage: { scale: 3 },
};

// Convert draft.size (point-size semantics) → billboard width/height
export function billboardDimsFromDraft(draft) {
  const size = Number(draft.size ?? draft.pointSize ?? 10);
  const meta = ICON_META[draft.iconId] || ICON_META.pin; // default heuristic
  const s = size * (meta.scale || 1.0);
  return { width: s, height: s };
}

// When reading back from an existing billboard, invert the scale so the modal shows
// the *point-equivalent* size the user expects.
export function draftSizeFromBillboard(ent, iconId, fallback = 10) {
  const raw = Number(ent.billboard?.width ?? ent.billboard?.height ?? fallback);
  const meta = ICON_META[iconId] || ICON_META.pin;
  const size = raw / (meta.scale || 1.0);
  return Math.max(1, Math.round(size));
}

const SVG_TEMPLATES = {
  pin: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <path fill="${hex}" d="M12 2a6 6 0 0 0-6 6c0 4.418 6 12 6 12s6-7.582 6-12a6 6 0 0 0-6-6zm0 8.5a2.5 2.5 0 1 1 0-5a2.5 2.5 0 0 1 0 5z"/>
</svg>`.trim(),
  flag: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <path fill="${hex}" d="M4 3h2v18H4zM6 3h10l-1.5 3L18 9H6z"/>
</svg>`.trim(),
  star: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <path fill="${hex}" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2L9.19 8.62L2 9.24l5.46 4.73L5.82 21z"/>
</svg>`.trim(),
  toilet: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <!-- tank -->
  <rect x="3" y="3" width="6" height="6" rx="1" ry="1" fill="${hex}"/>
  <!-- bowl -->
  <path fill="${hex}" d="M8 9h10a1 1 0 0 1 1 1v2a5 5 0 0 1-5 5h-1.5a5.5 5.5 0 0 1-5.5-5.5V10a1 1 0 0 1 1-1z"/>
  <!-- base -->
  <rect x="11" y="17" width="4" height="3" rx="1" fill="${hex}"/>
</svg>`.trim(),

  outlet: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <!-- plate -->
  <rect x="4" y="4" width="16" height="16" rx="2.5" ry="2.5" fill="${hex}"/>
  <!-- slots (knockouts) -->
  <circle cx="10" cy="12" r="1.6" fill="#ffffff"/>
  <circle cx="14" cy="12" r="1.6" fill="#ffffff"/>
  <rect x="11" y="15.2" width="2" height="1.6" rx="0.6" fill="#ffffff"/>
</svg>`.trim(),

  borehole: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <!-- ring using evenodd to make a donut -->
  <path fill="${hex}" fill-rule="evenodd" d="M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18Zm0 3.8a5.2 5.2 0 1 0 0 10.4a5.2 5.2 0 0 0 0-10.4Z"/>
  <!-- drill string -->
  <rect x="11" y="2" width="2" height="6" fill="${hex}"/>
  <!-- drill bit -->
  <path fill="${hex}" d="M12 8l2 2l-2 2l-2-2z"/>
</svg>`.trim(),

  water: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <!-- droplet -->
  <path fill="${hex}" d="M12 2c3.5 4.6 6 7.6 6 10.2A6 6 0 0 1 6 12.2C6 9.6 8.5 6.6 12 2z"/>
  <!-- sparkle -->
  <path fill="${hex}" d="M17.5 6.5h1.5v1.5h-1.5zM18.8 4.2l1.1-1.1l1.1 1.1l-1.1 1.1zM19.5 8.8l.9.9l-.9.9l-.9-.9z"/>
</svg>`.trim(),

  sewage: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <!-- pipe run -->
  <path fill="${hex}" d="M4 7h8a3 3 0 0 1 3 3v2h3a2 2 0 0 1 2 2v4h-3v-3h-5a3 3 0 0 1-3-3V10H4z"/>
  <!-- cleanout cap -->
  <rect x="9.5" y="5" width="5" height="2" rx="1" fill="${hex}"/>
</svg>`.trim(),
};

// Build a high-DPI data URL for an SVG icon.
// - iconId: key in SVG_TEMPLATES
// - hex: fill color (e.g. "#0066ff")
// - displaySizePx: the size you will set on billboard.width/height (CSS px)
// - supersample: texture multiplier (2 or 3 recommended)
export function svgIconDataUrl(iconId, hex, displaySizePx, supersample = 3) {
  const tmpl = SVG_TEMPLATES[iconId];
  if (!tmpl) return null;

  const ss = Math.max(
    1,
    Math.floor(supersample || window.devicePixelRatio || 2)
  );
  const texSize = Math.max(16, Math.round(displaySizePx * ss));

  let svg = tmpl(hex);

  // Normalize the outer <svg ...> to ensure a big intrinsic raster size
  // Assumes your templates include width/height/viewBox="0 0 24 24"
  svg = svg
    .replace(/viewBox="[^"]*"/, `viewBox="0 0 24 24"`)
    .replace(/width="[^"]*"/, `width="${texSize}"`)
    .replace(/height="[^"]*"/, `height="${texSize}"`);

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function draftFromMarkerEntity(ent) {
  const saved = ent.__draft || {};
  if (saved && (saved.iconId || saved.size || saved.color)) {
    return { ...defaultMarkerDraft, ...saved };
  }

  const out = { ...defaultMarkerDraft };

  if (ent.point) {
    out.iconId = "dot";
    out.size = Number(ent.point.pixelSize ?? out.size);
    out.color = Color.toCssColorString?.(ent.point.color) || out.color;
    out.outlineColor =
      Color.toCssColorString?.(ent.point.outlineColor) || out.outlineColor;
    out.outlineWidth = Number(ent.point.outlineWidth ?? out.outlineWidth);
  } else if (ent.billboard) {
    const iconId = saved.iconId || "pin";
    out.iconId = iconId;
    out.size = draftSizeFromBillboard(ent, iconId, out.size);

    // best-effort color parse from data URL if needed
    try {
      const url = ent.billboard.image && `${ent.billboard.image}`;
      const decoded = url.startsWith("data:") ? decodeURIComponent(url) : "";
      const m = decoded.match(/fill="(#[0-9a-fA-F]{3,8})"/);
      if (m) out.color = m[1];
    } catch {}
  }

  return out;
}

/**
 * Apply the draft to an existing marker entity (point or billboard).
 * If iconId === 'dot', we use Cesium.PointGraphics; otherwise we switch to BillboardGraphics.
 */
export function applyDraftToMarkerEntity(ent, draft) {
  const d = { ...defaultMarkerDraft, ...(draft || {}) };

  // Switch by mode
  if (d.iconId === "dot") {
    // Hide/remove billboard branch
    if (ent.billboard) {
      try {
        ent.billboard.show = false;
      } catch {}
      ent.billboard = undefined;
    }
    // Ensure a proper PointGraphics exists
    if (!ent.point || !(ent.point instanceof PointGraphics)) {
      ent.point = new PointGraphics();
    }
    ent.point.pixelSize = d.size;
    ent.point.color = toCesiumColor(d.color);
    ent.point.outlineColor = toCesiumColor(d.outlineColor);
    ent.point.outlineWidth = d.outlineWidth;
    ent.point.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    ent.point.show = true;
  } else {
    // Hide/remove point branch
    if (ent.point) {
      try {
        ent.point.show = false;
      } catch {}
      ent.point = undefined;
    }

    // Compute scaled billboard dimensions and build a matching hi-DPI texture
    const dims = billboardDimsFromDraft(d); // <-- applies ICON_META.scale
    const ss = Math.max(2, Math.floor(window.devicePixelRatio || 2));
    const dataUrl =
      svgIconDataUrl(
        d.iconId,
        d.color,
        Math.max(dims.width, dims.height),
        ss
      ) ||
      svgIconDataUrl("pin", d.color, Math.max(dims.width, dims.height), ss);

    // Ensure a proper BillboardGraphics exists
    if (!ent.billboard || !(ent.billboard instanceof BillboardGraphics)) {
      ent.billboard = new BillboardGraphics();
    }
    ent.billboard.image = dataUrl;
    ent.billboard.width = dims.width; // <-- scaled size
    ent.billboard.height = dims.height; // <-- scaled size
    ent.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    ent.billboard.horizontalOrigin = HorizontalOrigin.CENTER;
    ent.billboard.verticalOrigin = VerticalOrigin.BOTTOM;
    ent.billboard.show = true;
  }

  ent.__draft = d;
  ent.lastUpdated = new Date().toISOString();
  ent.isActive = true;
  ent.show = true;
}
