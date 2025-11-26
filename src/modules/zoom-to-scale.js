// src/modules/zoom-to-scale.js
import { Cartographic, Cartesian3, EllipsoidGeodesic } from "cesium";

// MUST match the value used in ScaleBar.jsx
const METERS_PER_CSS_PIXEL = 0.0254 / 96; // ≈ 0.0002645833 m

// Generate your requested scale steps:
// 1:25, 1:50, 1:75, 1:100, 1:125 ... 1:1000 (step 25)
// 1:1100, 1:1200 ... 1:2000 (step 100)
// 1:3000, 1:4000 ... 1:25000 (step 1000)
export const DEFAULT_SCALE_STEPS = (() => {
  const steps = [];

  // 25 → 1000, step 25
  for (let d = 25; d <= 1000; d += 25) steps.push(d);

  // 1100 → 2000, step 100
  for (let d = 1100; d <= 2000; d += 100) steps.push(d);

  // 3000 → 25000, step 1000
  for (let d = 3000; d <= 25000; d += 1000) steps.push(d);

  return steps;
})();

// Measure how many meters are represented by widthPx pixels at screen center
export function measureScaleMeters(viewer, widthPx = 140) {
  const { scene, camera } = viewer;
  const canvas = scene.canvas;

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return null;

  const center = { x: Math.round(w / 2), y: Math.round(h / 2) };
  const right = { x: center.x + widthPx, y: center.y };

  const e = scene.globe.ellipsoid;
  const p0 = camera.pickEllipsoid(center, e);
  const p1 = camera.pickEllipsoid(right, e);
  if (!p0 || !p1) return null;

  const c0 = Cartographic.fromCartesian(p0);
  const c1 = Cartographic.fromCartesian(p1);
  const geod = new EllipsoidGeodesic(c0, c1);
  const dist = geod.surfaceDistance; // meters across widthPx pixels
  return isFinite(dist) && dist > 0 ? dist : null;
}

// Set camera height (keeping lon/lat and orientation)
function setHeight(viewer, heightMeters) {
  const cam = viewer.camera;
  const carto = Cartographic.fromCartesian(cam.position);
  const destination = Cartesian3.fromRadians(
    carto.longitude,
    carto.latitude,
    Math.max(1, heightMeters)
  );
  cam.setView({
    destination,
    orientation: {
      heading: cam.heading,
      pitch: cam.pitch,
      roll: cam.roll,
    },
  });
}

// Compute height that yields targetMeters across widthPx, with 1–2 refinement passes
export function zoomToScaleMeters(viewer, targetMeters, widthPx = 140) {
  const cam = viewer.camera;
  const carto = Cartographic.fromCartesian(cam.position);
  const currentHeight = carto.height;

  const currentMeters = measureScaleMeters(viewer, widthPx);
  if (!currentMeters) return;

  // First guess: in nadir view m/px ~ proportional to height
  let h = currentHeight * (targetMeters / currentMeters);

  // Apply and refine once or twice
  for (let i = 0; i < 2; i++) {
    setHeight(viewer, h);
    const m = measureScaleMeters(viewer, widthPx);
    if (!m) break;
    const ratio = targetMeters / m;
    // If close enough, stop (within ~1 %)
    if (Math.abs(1 - ratio) < 0.01) break;
    h = Math.max(1, h * ratio);
  }
}

// Compute the *current* map scale denominator (1 : denom)
export function currentScaleDenominator(viewer, widthPx = 140) {
  const meters = measureScaleMeters(viewer, widthPx);
  if (!meters) return null;

  const metersPerPixelGround = meters / widthPx;
  const denom = metersPerPixelGround / METERS_PER_CSS_PIXEL;
  return isFinite(denom) && denom > 0 ? denom : null;
}

// Jump to the next/previous scale step (1:denom) from a scale-step list
export function zoomToNextScaleStep(
  viewer,
  direction, // +1 = zoom OUT, -1 = zoom IN
  widthPx = 140,
  scaleSteps = DEFAULT_SCALE_STEPS
) {
  const epsilon = 1e-6;
  const denom = currentScaleDenominator(viewer, widthPx);
  if (!denom) return;

  let targetDenom = denom;

  if (direction > 0) {
    // zoom OUT → next larger scale denominator
    targetDenom =
      scaleSteps.find((d) => d > denom * (1 + 0.02)) ??
      scaleSteps[scaleSteps.length - 1];
  } else if (direction < 0) {
    // zoom IN → next smaller scale denominator
    const smaller = scaleSteps.filter((d) => d < denom * (1 - 0.02));
    targetDenom = smaller.length ? smaller[smaller.length - 1] : scaleSteps[0];
  }

  if (Math.abs(targetDenom - denom) < epsilon) return; // already at edge

  // Convert target scale denominator → target meters across widthPx
  // meters-per-pixel on ground at that scale:
  const metersPerPixelTarget = targetDenom * METERS_PER_CSS_PIXEL;
  const targetMeters = metersPerPixelTarget * widthPx;

  zoomToScaleMeters(viewer, targetMeters, widthPx);
}
