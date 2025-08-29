import { getApiToken, getResource, getJourneyPositionsBoundaryBox } from "./vasttrafik-api.js";
import { viewer } from "../viewer.js";
import { hexToRgb } from "../utils.js";
import { arbitraryPause } from "../utils-cesium.js";

// --- State ---
let currentJourneyItems = new Map();     // ref -> Entity
let positionProps = new Map();           // ref -> SampledPositionProperty
let lastSampleTime = new Map();          // ref -> JulianDate of last sample
let intervalId = null;

// --- Tuning ---
const POLL_SECONDS    = 1;      // fetch cadence (s)
const LOOKAHEAD_SEC   = 3.5;    // > POLL_SECONDS to cover hiccups
const NOISE_METERS    = 2;      // treat moves below this as jitter
const HEIGHT_OFFSET_M = 0.8;    // slight offset to avoid clamp popping

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
function makeScaleByDistanceProperty(positionProperty, options = {}) {
  const {
    near = 80,
    nearScale = 1.25,
    far = 5000,
    farScale = 0.16,
    base = 3.5
  } = options;
  console.log(options)
  const lerp = (a, b, t) => a + (b - a) * t;
  return new Cesium.CallbackProperty((time) => {
    const pos = positionProperty.getValue(time);
    if (!pos) return base * nearScale;
    const cam = viewer.camera.positionWC;
    const dist = Cesium.Cartesian3.distance(cam, pos);
    const t = Cesium.Math.clamp((dist - near) / (far - near), 0.0, 1.0);
    return base * lerp(nearScale, farScale, t);
  }, false);
}

// Add a sample with strictly increasing time.
// If movement is below NOISE_METERS, add a keepalive sample at the last position (prevents gaps).
function addSampleForRef(ref, lon, lat, atJulianDate) {
  const spp = createOrGetSPP(ref);

  const lastT = lastSampleTime.get(ref);
  let t = atJulianDate;

  if (lastT && Cesium.JulianDate.lessThanOrEquals(t, lastT)) {
    t = Cesium.JulianDate.addSeconds(lastT, 0.001, new Cesium.JulianDate());
  }

  if (lastT) {
    const lastPos = spp.getValue(lastT);
    if (lastPos) {
      const newPos = toCartesian(lon, lat);
      const dist = Cesium.Cartesian3.distance(lastPos, newPos);
      if (dist < NOISE_METERS) {
        spp.addSample(t, lastPos); // keepalive
        lastSampleTime.set(ref, t);
        return spp;
      }
    }
  }

  spp.addSample(t, toCartesian(lon, lat));
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
}

// --- Visualization / entity creation ---
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
    const uri = isTrain ? trainUri : busUri; // <-- ensures buses always get a model

    // === DEBUG/CONFIRMATION SWITCHES ===
    // 1) Force buses to a huge, constant scale so you can verify the model is there.
    //    Set to 0 later to re-enable distance-based scaling.
    const FORCE_BUS_CONSTANT_SCALE = 60;  // try 60–100 to be unmistakable

    // 2) Make bus models glow so you can’t miss them while tuning
    const DEBUG_BUS_SILHOUETTE = true;

    // If you want distance-based scaling later, keep this helper:
  /*   const scaleProp = makeScaleByDistanceProperty(spp, {
      near: 35,
      nearScale: 1.8,
      far: 4000,
      farScale: 0.5,
      base: isBus ? 20.0 : 3.0
    });

    console.log(scaleProp) */
console.log(isBus)

const addedJourney = viewer.entities.add({
  position: spp,
  orientation: new Cesium.VelocityOrientationProperty(spp),

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

    // CRITICAL: let scale be the only thing that controls size
    minimumPixelSize: isBus ? 0 : 0,  // no pixel floor for buses
    // maximumScale: (omit entirely),

    // >>> Hard constant scale for buses <<<
    // If the bus still looks unchanged, your model scale isn’t being applied at all.
    // Start with 60; if still small, try 120 or 240.
    scale: isBus ? 112 : 1.5,   // trains keep a modest constant for now

    runAnimations: false,

    // optional: make it obvious while testing
    // silhouetteColor: isBus ? Cesium.Color.YELLOW : undefined,
    // silhouetteSize: isBus ? 2.0 : 0.0
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
      if (entity) viewer.entities.remove(entity);
      currentJourneyItems.delete(ref);
      positionProps.delete(ref);
      lastSampleTime.delete(ref);
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
