
import { viewer } from "../viewer.js";
export let activeSpeedTracker = null

// Estimate speed (km/h) from a SampledPositionProperty using a central difference.
function estimateSpeedKmh(positionProperty, time, dtSec = 2.0) {
  const half = dtSec / 2;
  const t1 = Cesium.JulianDate.addSeconds(time, -half, new Cesium.JulianDate());
  const t2 = Cesium.JulianDate.addSeconds(time,  half, new Cesium.JulianDate());

  const p1 = positionProperty.getValue(t1);
  const p2 = positionProperty.getValue(t2);
  if (!p1 || !p2) return undefined;

  // Geodesic surface distance is better for ground vehicles
  const c1 = Cesium.Cartographic.fromCartesian(p1);
  const c2 = Cesium.Cartographic.fromCartesian(p2);
  const geod = new Cesium.EllipsoidGeodesic(c1, c2);
  const meters = geod.surfaceDistance;
  if (!isFinite(meters)) return undefined;

  return (meters / dtSec) * 3.6; // m/s -> km/h
}

export function updateSpeedDom(kmh, entity) {
  // Minimal example: update #bus-speed if present
  const el = document.getElementById("speed-tracker");
  if (!el) return;
  el.textContent = (kmh == null) ? "– km/h" : `${Math.round(kmh)} km/h`;
  // If you have a richer panel function, call it here instead (e.g., showJourneyInfo(entity))
}

export function stopSpeedTracker() {
  if (!activeSpeedTracker) return;
  viewer.clock.onTick.removeEventListener(activeSpeedTracker.onTick);
  updateSpeedDom(null, activeSpeedTracker.entity);
  activeSpeedTracker = null;
}

export function startSpeedTracker(entity, { dtSec = 2.0, alpha = 0.3 } = {}) {
  // Only one tracker at a time
  stopSpeedTracker();

  let ema = null; // exponential moving average state

  const onTick = (clock) => {
    if (!entity || !entity.position) return;
    const raw = estimateSpeedKmh(entity.position, clock.currentTime, dtSec);
    if (raw == null) return;

    ema = (ema == null) ? raw : ema + alpha * (raw - ema);
    entity.speedKmh = ema; // handy if you want to read it elsewhere
    updateSpeedDom(ema, entity);
  };

  viewer.clock.onTick.addEventListener(onTick);
  activeSpeedTracker = { entity, onTick, ema, dtSec, alpha };
}
