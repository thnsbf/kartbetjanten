
import { viewer } from "../viewer.js";

// util: ensure the entity uses a SampledPositionProperty with smooth interpolation


export function ensureSampledPosition(entity) {
  if (entity.position instanceof Cesium.SampledPositionProperty) {
    return entity.position;
  }

  const now = viewer.clock.currentTime;

  // capture current Cartesian before we replace position
  let curr;
  if (entity.position && typeof entity.position.getValue === "function") {
    curr = entity.position.getValue(now);
  } else {
    curr = entity.position || Cesium.Cartesian3.ZERO;
  }

  const spp = new Cesium.SampledPositionProperty();

  // Smooth interpolation between samples
  spp.setInterpolationOptions({
    interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
    interpolationDegree: 2
  });

  // Hold when briefly outside sample range (prevents flicker)
  spp.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
  spp.forwardExtrapolationDuration = 15; // was 5
  spp.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
  spp.backwardExtrapolationDuration = 15;


  if (curr) spp.addSample(now, curr);

  entity.position = spp;

  // Keep icon pointing along velocity (nice for vehicles)
  entity.orientation = new Cesium.VelocityOrientationProperty(entity.position);

  return spp;
}

// Keep availability generous so momentary timing gaps don’t hide the entity
export function relaxAvailability(entity, past = 60, future = 30) {
  const now = viewer.clock.currentTime;
  const start = Cesium.JulianDate.addSeconds(now, -past, new Cesium.JulianDate());
  const stop  = Cesium.JulianDate.addSeconds(now,  future, new Cesium.JulianDate());
  entity.availability = new Cesium.TimeIntervalCollection([
    new Cesium.TimeInterval({ start, stop })
  ]);
}

// Optional: occasionally trim very old samples to avoid unbounded growth
export function trimSamples(entity, keepPastSeconds = 180) {
  const pos = entity.position;
  if (!(pos instanceof Cesium.SampledPositionProperty)) return;

  const now = viewer.clock.currentTime;
  const cutoff = Cesium.JulianDate.addSeconds(now, -keepPastSeconds, new Cesium.JulianDate());

  // Remove all samples strictly before 'cutoff'
  const interval = new Cesium.TimeInterval({
    start: Cesium.JulianDate.MIN_VALUE,
    stop: cutoff,
    isStartIncluded: true,
    isStopIncluded: false
  });

  pos.removeSamples(interval);
}


// Tiny jitter guard (meters) to avoid spamming samples for sub-meter noise
const MIN_MOVE_METERS = 0.5;
export function movedEnough(a, b) {
  if (!a || !b) return true;
  return Cesium.Cartesian3.distance(a, b) >= MIN_MOVE_METERS;
}

// put near your helpers
export const EPS = 0.001; // seconds

export function addFutureSampleMonotonic(entity, when, cart) {
  const pos = entity.position;
  if (!(pos instanceof Cesium.SampledPositionProperty)) return;
  const last = pos._property?._lastJulianDateAdded || pos._lastJulianDateAdded; // private-ish; fallback below
  let t = when;

  // Fallback: compute last sample time from internal array if needed
  if (!last && pos._times && pos._times.length) {
    const lastIdx = pos._times.length - 1;
    const lastTime = pos._times[lastIdx];
    if (Cesium.JulianDate.greaterThanOrEquals(lastTime, t)) {
      t = Cesium.JulianDate.addSeconds(lastTime, EPS, new Cesium.JulianDate());
    }
  } else if (last && Cesium.JulianDate.greaterThanOrEquals(last, t)) {
    t = Cesium.JulianDate.addSeconds(last, EPS, new Cesium.JulianDate());
  }

  pos.addSample(t, cart);
}
