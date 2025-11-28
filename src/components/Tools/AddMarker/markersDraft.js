// src/components/Tools/AddMarker/markersDraft.js
import {
  Color,
  BillboardGraphics,
  HorizontalOrigin,
  VerticalOrigin,
  PointGraphics,
  HeightReference,
} from "cesium";

export const defaultMarkerDraft = {
  size: 16, // used for point pixelSize OR billboard width/height (after scale)
  color: "#ff3b30", // main color (also used to tint SVGs)
  outlineColor: "#ffffff", // only used for 'dot' point markers
  outlineWidth: 2, // only used for 'dot' point markers
  iconId: "dot", // 'dot' | 'pin' | 'flag' | 'star' | 'triangle' | 'toilet' | 'outlet' | 'borehole' | 'water' | 'sewage'
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
    return Color.toCssColorString(col);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Icon scale mapping                                                        */
/* -------------------------------------------------------------------------- */
/** Visual scale per icon so an SVG (24×24 viewBox) matches a Cesium dot of the same "size". */
const ICON_META = {
  default: 2,
  pin: 2,
  flag: 2,
  star: 2,
  triangle: 2,
  toilet: 2,
  outlet: 2,
  borehole: 2,
  water: 2,
  sewage: 2,
};

function iconScale(iconId) {
  return ICON_META[iconId] ?? ICON_META.default;
}

/** Convert draft.size (point semantics) → billboard width/height. */
export function billboardDimsFromDraft(draft) {
  const size = Number(draft.size ?? draft.pointSize ?? 10);
  const s = size * iconScale(draft.iconId);
  return { width: s, height: s };
}

/** Invert billboard width/height back to modal "size" (point semantics). */
export function draftSizeFromBillboard(ent, iconId, fallback = 10) {
  const raw = Number(ent.billboard?.width ?? ent.billboard?.height ?? fallback);
  const sz = raw / iconScale(iconId);
  return Math.max(1, Math.round(sz));
}

/* -------------------------------------------------------------------------- */
/*  SVG templates                                                              */
/* -------------------------------------------------------------------------- */

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

  triangle: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <path fill="${hex}" d="M12 3L2 21h20L12 3z"/>
</svg>`.trim(),

  toilet: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <rect x="3" y="3" width="6" height="6" rx="1" ry="1" fill="${hex}"/>
  <path fill="${hex}" d="M8 9h10a1 1 0 0 1 1 1v2a5 5 0 0 1-5 5h-1.5a5.5 5.5 0 0 1-5.5-5.5V10a1 1 0 0 1 1-1z"/>
  <rect x="11" y="17" width="4" height="3" rx="1" fill="${hex}"/>
</svg>`.trim(),

  outlet: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <rect x="4" y="4" width="16" height="16" rx="2.5" ry="2.5" fill="${hex}"/>
  <circle cx="10" cy="12" r="1.6" fill="#ffffff"/>
  <circle cx="14" cy="12" r="1.6" fill="#ffffff"/>
  <rect x="11" y="15.2" width="2" height="1.6" rx="0.6" fill="#ffffff"/>
</svg>`.trim(),

  borehole: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <path fill="${hex}" fill-rule="evenodd" d="M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18Zm0 3.8a5.2 5.2 0 1 0 0 10.4a5.2 5.2 0 0 0 0-10.4Z"/>
  <rect x="11" y="2" width="2" height="6" fill="${hex}"/>
  <path fill="${hex}" d="M12 8l2 2l-2 2l-2-2z"/>
</svg>`.trim(),

  water: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <path fill="${hex}" d="M12 2c3.5 4.6 6 7.6 6 10.2A6 6 0 0 1 6 12.2C6 9.6 8.5 6.6 12 2z"/>
  <path fill="${hex}" d="M17.5 6.5h1.5v1.5h-1.5zM18.8 4.2l1.1-1.1l1.1 1.1l-1.1 1.1zM19.5 8.8l.9.9l-.9.9l-.9-.9z"/>
</svg>`.trim(),

  /*  sewage: (hex) =>
    `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24">
  <path fill="${hex}" d="M4 7h8a3 3 0 0 1 3 3v2h3a2 2 0 0 1 2 2v4h-3v-3h-5a3 3 0 0 1-3-3V10H4z"/>
  <rect x="9.5" y="5" width="5" height="2" rx="1" fill="${hex}"/>
</svg>`.trim(), */
};

/**
 * Build a high-DPI data URL for an SVG icon.
 * @param {string} iconId - key in SVG_TEMPLATES
 * @param {string} hex - fill color (e.g. "#0066ff")
 * @param {number} displaySizePx - the final billboard width/height (CSS px)
 * @param {number} supersample - texture multiplier (>= devicePixelRatio is nice)
 */
export function svgIconDataUrl(iconId, hex, displaySizePx, supersample = 3) {
  const tmpl = SVG_TEMPLATES[iconId];
  if (!tmpl) return null;

  const ss = Math.max(
    1,
    Math.floor(supersample || window.devicePixelRatio || 2)
  );
  const texSize = Math.max(16, Math.round(displaySizePx * ss));

  let svg = tmpl(hex);

  // Ensure a big intrinsic raster size (while keeping 24×24 viewBox)
  svg = svg
    .replace(/viewBox="[^"]*"/, `viewBox="0 0 24 24"`)
    .replace(/width="[^"]*"/, `width="${texSize}"`)
    .replace(/height="[^"]*"/, `height="${texSize}"`);

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* -------------------------------------------------------------------------- */
/*  Draft readers                                                              */
/* -------------------------------------------------------------------------- */

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
    // invert width/height back to "dot" size semantics
    out.size = draftSizeFromBillboard(ent, iconId, out.size);

    // best-effort color parse from data URL if needed
    try {
      const url = ent.billboard.image && `${ent.billboard.image}`;
      const decoded =
        url && url.startsWith("data:") ? decodeURIComponent(url) : "";
      const m = decoded && decoded.match(/fill="(#[0-9a-fA-F]{3,8})"/);
      if (m) out.color = m[1];
    } catch {}
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/*  Draft applier                                                              */
/* -------------------------------------------------------------------------- */
/**
 * Apply the draft to an existing marker entity (point or billboard).
 * If iconId === 'dot', we use Cesium.PointGraphics; otherwise we switch to BillboardGraphics.
 */
export function applyDraftToMarkerEntity(ent, draft) {
  const d = { ...defaultMarkerDraft, ...(draft || {}) };

  if (d.iconId === "dot") {
    // Hide/remove billboard branch
    if (ent.billboard) {
      try {
        ent.billboard.show = false;
      } catch {}
      ent.billboard = undefined;
    }
    // Ensure proper PointGraphics exists
    if (!ent.point || !(ent.point instanceof PointGraphics)) {
      ent.point = new PointGraphics();
    }
    ent.point.pixelSize = d.size;
    ent.point.color = toCesiumColor(d.color);
    ent.point.outlineColor = toCesiumColor(d.outlineColor);
    ent.point.outlineWidth = d.outlineWidth;
    ent.point.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    ent.point.heightReference = HeightReference.NONE;
    ent.point.show = true;
  } else {
    // Hide/remove point branch
    if (ent.point) {
      try {
        ent.point.show = false;
      } catch {}
      ent.point = undefined;
    }

    // Compute final display dims from "dot" size semantics
    const { width, height } = billboardDimsFromDraft(d);

    // High-DPI SVG texture sized for the final display footprint
    const ss = Math.max(2, Math.floor(window.devicePixelRatio || 2));
    const dataUrl =
      svgIconDataUrl(d.iconId, d.color, Math.max(width, height), ss) ||
      svgIconDataUrl("pin", d.color, Math.max(width, height), ss);

    // Ensure BillboardGraphics exists
    if (!ent.billboard || !(ent.billboard instanceof BillboardGraphics)) {
      ent.billboard = new BillboardGraphics();
    }
    ent.billboard.image = dataUrl;

    // Match the dot anchoring (centered) to avoid any jump when switching
    ent.billboard.horizontalOrigin = HorizontalOrigin.CENTER;
    ent.billboard.verticalOrigin = VerticalOrigin.CENTER;
    ent.billboard.pixelOffset = { x: 0, y: 0 };

    // Set scaled display size so SVG ≈ dot of same size
    ent.billboard.width = width;
    ent.billboard.height = height;

    ent.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    ent.billboard.heightReference = HeightReference.NONE;
    ent.billboard.show = true;
  }

  ent.__draft = d;
  ent.lastUpdated = new Date().toISOString();
  ent.isActive = true;
  ent.show = true;
}
