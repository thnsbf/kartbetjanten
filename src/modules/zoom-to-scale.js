import { Cartographic, Cartesian3, EllipsoidGeodesic } from "cesium";

// Measure how many meters are represented by widthPx pixels at screen center
export function measureScaleMeters(viewer, widthPx = 140) {
  const { scene, camera } = viewer;
  const canvas = scene.canvas;

  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return null;

  const center = { x: Math.round(w / 2), y: Math.round(h / 2) };
  const right  = { x: center.x + widthPx, y: center.y };

  // Top-down ellipsoid pick (works with your setup)
  const e  = scene.globe.ellipsoid;
  const p0 = camera.pickEllipsoid(center, e);
  const p1 = camera.pickEllipsoid(right,  e);
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
  const destination = Cartesian3.fromRadians(carto.longitude, carto.latitude, Math.max(1, heightMeters));
  cam.setView({
    destination,
    orientation: { heading: cam.heading, pitch: cam.pitch, roll: cam.roll }
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
    // If close enough, stop
    if (Math.abs(1 - ratio) < 0.01) break; // within ~1%
    h = Math.max(1, h * ratio);
  }
}

// Choose next/prev step from your list and jump to it
export function zoomToNextScaleStep(viewer, direction, widthPx = 140, steps = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17.5,20,22.5,25,27.5,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100,125,150,200,250,300,400,500,1000]) {
  const epsilon = 1e-6;
  const meters = measureScaleMeters(viewer, widthPx);
  if (!meters) return;

  let target = meters;
  if (direction > 0) {
    // zoom OUT → next larger label
    target = steps.find(s => s > meters * (1 + 0.02)) ?? steps[steps.length - 1];
  } else if (direction < 0) {
    // zoom IN → next smaller label
    const smaller = steps.filter(s => s < meters * (1 - 0.02));
    target = smaller.length ? smaller[smaller.length - 1] : steps[0];
  }

  // If already at the edge, do nothing
  if (Math.abs(target - meters) < epsilon) return;

  zoomToScaleMeters(viewer, target, widthPx);
}
