import { getApiToken, getResource, getJourneyPositionsBoundaryBox } from "./vasttrafik-api.js";
import { viewer } from "../viewer.js";
import { hexToRgb } from "../utils.js";
import { arbitraryPause } from "../utils-cesium.js";
import { startSpeedTracker, stopSpeedTracker, activeSpeedTracker } from "./vasttrafik-speed.js";

// --- State ---
let currentJourneyItems = new Map();     // ref -> Entity
let positionProps = new Map();           // ref -> SampledPositionProperty
let lastSampleTime = new Map();          // ref -> JulianDate of last sample
let intervalId = null;

// Quarantine for anti-teleport (ref -> {lon, lat, t, count})
let jumpQuarantine = new Map();

// --- Tuning ---
const POLL_SECONDS    = 1;      // fetch cadence (s)
const LOOKAHEAD_SEC   = 3.5;    // > POLL_SECONDS to cover hiccups
const NOISE_METERS    = 5;      // ↑ bigger jitter gate to avoid tiny backsteps at stops (was 2)
const HEIGHT_OFFSET_M = 0.8;    // slight offset to avoid clamp popping

// Anti-teleport thresholds
const JUMP_METERS         = 200;  // suspect if new point is farther than this from last
const MAX_SPEED_KMH       = 120;  // suspect if implied speed exceeds this
const CONFIRM_RADIUS_M    = 100;  // require next sample to land within this of quarantined point
const QUARANTINE_TTL_SEC  = 12;   // expire quarantine if not confirmed in this time

// --- Assets ---
const busUri   = await Cesium.IonResource.fromAssetId(3653053);
const trainUri = await Cesium.IonResource.fromAssetId(3653065);

// --- Helpers ---
function toCartesian(lon, lat, height = HEIGHT_OFFSET_M) {
  return Cesium.Cartesian3.fromDegrees(lon, lat, height);
}
function nowJulian() {
  return viewer.clock.currentTime.clone();
}
function ensureExtrapolation(spp) {
  spp.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
  spp.forwardExtrapolationDuration = 30; // seconds
  spp.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
  spp.backwardExtrapolationDuration = 15;
}
function ensureAvailability(entity) {
  const start = Cesium.JulianDate.addHours(viewer.clock.currentTime, -12, new Cesium.JulianDate());
  const stop  = Cesium.JulianDate.addHours(viewer.clock.currentTime,  +24, new Cesium.JulianDate());
  entity.availability = new Cesium.TimeIntervalCollection([
    new Cesium.TimeInterval({ start, stop })
  ]);
}
function createOrGetSPP(ref) {
  let spp = positionProps.get(ref);
  if (!spp) {
    spp = new Cesium.SampledPositionProperty();
    spp.setInterpolationOptions({
      interpolationAlgorithm: Cesium.LinearApproximation,
      interpolationDegree: 1
    });
    ensureExtrapolation(spp);
    positionProps.set(ref, spp);
  }
  return spp;
}

// ---- Sticky orientation helpers ----

// Estimate speed (m/s) using a central difference over dtSec seconds
function estimateSpeedMps(positionProperty, time, dtSec = 1.5) {
  const half = dtSec / 2;
  const t1 = Cesium.JulianDate.addSeconds(time, -half, new Cesium.JulianDate());
  const t2 = Cesium.JulianDate.addSeconds(time,  half, new Cesium.JulianDate());
  const p1 = positionProperty.getValue(t1);
  const p2 = positionProperty.getValue(t2);
  if (!p1 || !p2) return 0;
  const meters = Cesium.Cartesian3.distance(p1, p2);
  return meters / dtSec;
}

/**
 * Orientation that "sticks" to the last good moving orientation when speed is low.
 * Hysteresis avoids flip/flop around the threshold.
 */
function makeStickyVelocityOrientation(positionProperty, opts = {}) {
  const base = new Cesium.VelocityOrientationProperty(positionProperty);

  const dtSec           = opts.dtSec ?? 1.5;     // window for speed estimate
  const stopSpeedKmh    = opts.stopSpeedKmh ?? 2.5; // below this, HOLD (~0.7 m/s)
  const startSpeedKmh   = opts.startSpeedKmh ?? 4.0; // above this, UPDATE (~1.1 m/s)
  const stopMps         = stopSpeedKmh / 3.6;
  const startMps        = startSpeedKmh / 3.6;

  let moving = false;
  let lastMovingOrientation = null;

  return new Cesium.CallbackProperty((time) => {
    const v = estimateSpeedMps(positionProperty, time, dtSec);

    // hysteresis
    if (moving) {
      if (v < stopMps) moving = false;
    } else {
      if (v > startMps) moving = true;
    }

    if (moving) {
      const o = base.getValue(time);
      if (o) lastMovingOrientation = o;
      return o || lastMovingOrientation;
    } else {
      // HOLD last known moving orientation while "stopped"
      return lastMovingOrientation || base.getValue(time);
    }
  }, false);
}

// ---- Distance helpers for anti-teleport ----
function cartesianToCarto(cart) {
  return Cesium.Cartographic.fromCartesian(cart);
}
function surfaceDistanceMetersCarto(c1, c2) {
  const geod = new Cesium.EllipsoidGeodesic(c1, c2);
  return geod.surfaceDistance;
}

// Add a sample with strictly increasing time and anti-teleport gating.
// - If move < NOISE_METERS => keepalive at lastPos.
// - If move is a big jump AND implied speed is unrealistic => quarantine
//   until the next sample confirms it by landing near the same place.
// - While quarantined => keepalive at lastPos (prevents yank).
function addSampleForRef(ref, lon, lat, atJulianDate) {
  const spp = createOrGetSPP(ref);

  const lastT = lastSampleTime.get(ref);
  let t = atJulianDate;

  if (lastT && Cesium.JulianDate.lessThanOrEquals(t, lastT)) {
    t = Cesium.JulianDate.addSeconds(lastT, 0.001, new Cesium.JulianDate());
  }

  // New point in Cartographic
  const newCarto = new Cesium.Cartographic(
    Cesium.Math.toRadians(lon),
    Cesium.Math.toRadians(lat),
    HEIGHT_OFFSET_M
  );

  // Expire stale quarantine
  const q = jumpQuarantine.get(ref);
  if (q && lastT) {
    const age = Cesium.JulianDate.secondsDifference(t, q.t);
    if (age > QUARANTINE_TTL_SEC) jumpQuarantine.delete(ref);
  }

  if (lastT) {
    const lastPos = spp.getValue(lastT);
    if (lastPos) {
      const lastCarto = cartesianToCarto(lastPos);
      const dist = surfaceDistanceMetersCarto(lastCarto, newCarto);

      // Keepalive for tiny jitter
      if (dist < NOISE_METERS) {
        spp.addSample(t, lastPos); // keepalive (prevents tiny backward nudge)
        lastSampleTime.set(ref, t);
        return spp;
      }

      // Sanity-check implied speed
      const dtSec = Math.max(0.001, Cesium.JulianDate.secondsDifference(t, lastT));
      const speedKmh = (dist / dtSec) * 3.6;

      // If it's a huge jump AND too fast to be plausible => quarantine it
      if (dist > JUMP_METERS && speedKmh > MAX_SPEED_KMH) {
        if (!q) {
          // first suspicious sample -> store & hold position
          jumpQuarantine.set(ref, { lon, lat, t, count: 1 });
          spp.addSample(t, lastPos);        // hold at last position
          lastSampleTime.set(ref, t);
          return spp;
        } else {
          // we already have a suspicious sample; confirm if close to it
          const qCarto = new Cesium.Cartographic(
            Cesium.Math.toRadians(q.lon),
            Cesium.Math.toRadians(q.lat),
            HEIGHT_OFFSET_M
          );
          const dConfirm = surfaceDistanceMetersCarto(qCarto, newCarto);
          if (dConfirm <= CONFIRM_RADIUS_M) {
            // confirmed: accept the jump, clear quarantine
            jumpQuarantine.delete(ref);
          } else {
            // still inconsistent: keep holding
            spp.addSample(t, lastPos);
            lastSampleTime.set(ref, t);
            return spp;
          }
        }
      } else {
        // Not suspicious => clear any prior quarantine
        if (q) jumpQuarantine.delete(ref);
      }
    }
  }

  // Accept the new sample
  spp.addSample(t, Cesium.Cartesian3.fromRadians(newCarto.longitude, newCarto.latitude, HEIGHT_OFFSET_M));
  lastSampleTime.set(ref, t);
  return spp;
}

// --- Public API ---
export async function initializeVasttrafik() {
  if (!localStorage.getItem("access_token")) {
    const apiToken = await getApiToken();
    localStorage.setItem("access_token", JSON.stringify(apiToken));
  }

  const testFetch = await getResource(`/journeys?originGid=9021014005460000&destinationGid=9021014004090000`);
  if (!testFetch) {
    const apiToken = await getApiToken();
    localStorage.setItem("access_token", JSON.stringify(apiToken));
  }

  // Simulation clock
  viewer.clock.shouldAnimate = true;
  viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
  viewer.clock.multiplier = 1;

  const journeyPositions = await getJourneyPositionsBoundaryBox(
    58.095256, 12.052452, 58.352497, 12.596755
  );

  if (currentJourneyItems.size < 1) {
    await visualizeJourneyPositions(journeyPositions);
  }

  // Poll for updates
  intervalId = setInterval(() => {
    fetchJourneyUpdates();
  }, POLL_SECONDS * 1000);
}

export async function deInitializeVasttrafik() {
  clearInterval(intervalId);
  await arbitraryPause(1000);
  currentJourneyItems.forEach(entity => viewer.entities.remove(entity));
  currentJourneyItems.clear();
  positionProps.clear();
  lastSampleTime.clear();
  jumpQuarantine.clear();
}

// --- VISUALIZATION / ENTITY CREATION ---
async function visualizeJourneyPositions(arrayOfJourneys) {
  for (let i = 0; i < arrayOfJourneys.length; i++) {
    const journey = arrayOfJourneys[i];

    // Colors (safe defaults)
    const bgHex = journey?.line?.backgroundColor || "#0D47A1";
    const borHex = journey?.line?.borderColor    || "#082E66";
    const bgCol = hexToRgb(bgHex);
    const borCol = hexToRgb(borHex);

    // Normalize transport mode robustly
    const modeRaw = (journey?.line?.transportMode ?? "").toString();
    const mode = modeRaw.trim().toLowerCase();

    // Treat anything that's NOT an explicit "train" as a bus for now.
    // (Some feeds use "coach", "busrapid", etc.)
    const isTrain = mode.includes("train");
    const isBus   = !isTrain; // default to bus unless clearly train

    const vehicleType = isBus ? "Buss"
                      : isTrain ? "Tåg"
                      : "Okänt färdmedel";

    const ref = journey.detailsReference;
    const tNow = nowJulian();

    // Seed SPP with now + lookahead for orientation
    let spp = addSampleForRef(ref, journey.longitude, journey.latitude, tNow);
    const tFuture = Cesium.JulianDate.addSeconds(tNow, LOOKAHEAD_SEC, new Cesium.JulianDate());
    spp = addSampleForRef(ref, journey.longitude, journey.latitude, tFuture);

    // Choose a model URI. If it's not a train, use the BUS model.
    const uri = isTrain ? trainUri : busUri;

    const addedJourney = viewer.entities.add({
      position: spp,

      // <<< Sticky orientation to avoid flip when stopped >>>
      orientation: makeStickyVelocityOrientation(spp, {
        dtSec: 1.5,        // 1–2 s works well
        stopSpeedKmh: 10,  // your current thresholds
        startSpeedKmh: 10
      }),

      // Keep the point always visible
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromBytes(bgCol.r, bgCol.g, bgCol.b, 255),
        outlineColor: Cesium.Color.fromBytes(borCol.r, borCol.g, borCol.b, 255),
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },

      model: {
        uri,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,

        // Let scale control size; no floor/cap fighting it
        minimumPixelSize: 0,

        // Your current constants (tweak to taste)
        scale: isBus ? 112 : 1.5,
        runAnimations: false
      },

      description: `Location: (${journey.longitude}, ${journey.latitude})`
    });

    ensureAvailability(addedJourney);

    addedJourney.ref = ref;
    addedJourney.directionDetails = journey.directionDetails;
    addedJourney.line = journey.line;
    addedJourney.isVasttrafikVehicle = true;
    addedJourney.vehicleType = vehicleType;

    currentJourneyItems.set(ref, addedJourney);
  }
}

// --- Poll/update loop ---
async function fetchJourneyUpdates() {
  const journeyPositions = await getJourneyPositionsBoundaryBox(
    58.095256, 12.052452, 58.352497, 12.596755
  );

  console.log(journeyPositions)

  const newJourneys = [];
  const existingJourneys = [];

  let refsToBeRemoved = Array.from(currentJourneyItems.keys()).map(String);

  for (let i = 0; i < journeyPositions.length; i++) {
    const jp = journeyPositions[i];
    const ref = jp.detailsReference;
    if (currentJourneyItems.has(ref)) {
      existingJourneys.push(jp);
      refsToBeRemoved = refsToBeRemoved.filter(r => r !== ref);
    } else {
      newJourneys.push(jp);
    }
  }

  // Remove refs/items that left the bbox
  if (refsToBeRemoved.length > 0) {
    refsToBeRemoved.forEach(ref => {
      const entity = currentJourneyItems.get(ref);
      if (activeSpeedTracker?.entity === entity) {
        stopSpeedTracker();             // stop UI updates for the removed bus
      }
      if (entity) viewer.entities.remove(entity);
      currentJourneyItems.delete(ref);
      positionProps.delete(ref);
      lastSampleTime.delete(ref);
      jumpQuarantine.delete(ref);
    });
  }

  // Update positions of existing journeys with a future sample
  const tFuture = Cesium.JulianDate.addSeconds(viewer.clock.currentTime, LOOKAHEAD_SEC, new Cesium.JulianDate());

  existingJourneys.forEach(journey => {
    const ref = journey.detailsReference;
    addSampleForRef(ref, journey.longitude, journey.latitude, tFuture);

    // Keep availability window sliding forward
    const entity = currentJourneyItems.get(ref);
    if (entity) ensureAvailability(entity);
  });

  // Add any new journeys
  if (newJourneys.length > 0) {
    await visualizeJourneyPositions(newJourneys);
  }
}

// --- UX helper ---
export function selectJourney(ref) {
  const originalPixelSize = 10;
  const selectedPixelSize = 20;
  currentJourneyItems.forEach(item => {
    if (item.point) {
      item.point.pixelSize = (item.ref === ref) ? selectedPixelSize : originalPixelSize;
    }
  });
}
