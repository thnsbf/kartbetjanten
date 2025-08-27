import { getApiToken, getResource, getJourneyPositionsBoundaryBox } from "./vasttrafik-api.js";
import { viewer } from "../viewer.js";
import { hexToRgb } from "../utils.js";
import { arbitraryPause } from "../utils-cesium.js";
import { EPS, movedEnough, ensureSampledPosition, relaxAvailability, trimSamples, addFutureSampleMonotonic  } from "./vasttrafik-animation.js";
import { showJourneyInfo } from "./vasttrafik-dom.js";

let currentJourneyItems = []
let currentJourneyRefs = []
let sampledPositions = []
let intervalId = null

const busUri = await Cesium.IonResource.fromAssetId(3653053);
const trainUri = await Cesium.IonResource.fromAssetId(3653065);

export async function initializeVasttrafik() {
  if (!localStorage.getItem("access_token")) {
    const apiToken = await getApiToken();
    localStorage.setItem("access_token", JSON.stringify(apiToken));
  }

  const testFetch = await getResource(
    `/journeys?originGid=9021014005460000&destinationGid=9021014004090000`
  );

  if (!testFetch) {
    const apiToken = await getApiToken();
    localStorage.setItem("access_token", JSON.stringify(apiToken));
  }

  const timeOfFirstFetch = new Date().toISOString()
  console.log(timeOfFirstFetch)
  const journeyPositions = await getJourneyPositionsBoundaryBox(58.095256, 12.052452, 58.352497, 12.596755)
  console.log(journeyPositions)
   

  if (currentJourneyItems.length <= 0) {
    const visualizedJourneys = await visualizeJourneyPositions(journeyPositions)
    currentJourneyItems = [...visualizedJourneys]
  }
  
  intervalId = setInterval(() => {
    fetchJourneyUpdates()
  }, 1000);
}

export async function deInitializeVasttrafik() {
  clearInterval(intervalId)
  await arbitraryPause(1000)
  currentJourneyItems.forEach(journeyItem => viewer.entities.remove(journeyItem))
  currentJourneyItems = []
  currentJourneyRefs = []
}





async function visualizeJourneyPositions(arrayOfJourneys) {
  const returnArray = []
  for (let i = 0; i < arrayOfJourneys.length; i++) {
    const journey = arrayOfJourneys[i]
    const bgCol = hexToRgb(journey.line.backgroundColor)
    const borCol = hexToRgb(journey.line.borderColor)

    const transpMode = journey.line.transportMode
    const vehicleType = transpMode === "bus" ? "Buss" : transpMode === "tram" ? "Spårvagn" : transpMode === "train" ? "Tåg" : transpMode === "ferry" ? "Båt" : transpMode === "taxi" ? "Taxi" : "Okänt färdmedel"
    const position = Cesium.Cartesian3.fromDegrees(journey.longitude, journey.latitude)
    const addedJourney = await viewer.entities.add({
      description: `Location: (${journey.longitude}, ${journey.latitude})`,
      position: position,
      point: { 
        pixelSize: 10, 
        color: Cesium.Color.fromBytes(bgCol.r, bgCol.g, bgCol.b, 255),
        outlineColor: Cesium.Color.fromBytes(borCol.r, borCol.g, borCol.b, 255),
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }/* ,
      model: { 
        uri: transpMode === 'bus' ? busUri : transpMode === 'train' ? trainUri : null,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,  // <- key fix
        scale: 1.0,
        minimumPixelSize: 240, // makes it visible at distance
        runAnimations: false,
      
      }  */

    });
    addedJourney.ref = journey.detailsReference
    addedJourney.directionDetails = journey.directionDetails
    addedJourney.line = journey.line
    addedJourney.isVasttrafikVehicle = true
    addedJourney.vehicleType = vehicleType
    returnArray.push(addedJourney)
    currentJourneyRefs.push(journey.detailsReference)
  }
  returnArray.forEach(entity => {
    ensureSampledPosition(entity);
    relaxAvailability(entity, 600, 120);
  });
  return returnArray
}
const POLL_SECONDS  = 1;    // your fetch cadence
const LOOKAHEAD_SEC = 1.5;  // add future samples slightly beyond cadence

async function fetchJourneyUpdates() {

  // Make sure the clock actually ticks
  viewer.clock.shouldAnimate = true;
  viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
  viewer.clock.multiplier = 1;

  const journeyPositions = await getJourneyPositionsBoundaryBox(
    58.095256, 12.052452, 58.352497, 12.596755
  );

  const newJourneys = [];
  const newJourneyRefs = [];
  const existingJourneys = [];
  const allRefsFromCurrentFetch = [];

  for (let i = 0; i < journeyPositions.length; i++) {
    const journeyRef = journeyPositions[i].detailsReference;
    allRefsFromCurrentFetch.push(journeyRef);

    if (currentJourneyRefs.includes(journeyRef)) {
      existingJourneys.push(journeyPositions[i]);
    } else {
      newJourneys.push(journeyPositions[i]);
      newJourneyRefs.push(journeyRef);
    }
  }

  // Remove refs/items that left the bbox
  const refsToBeRemoved = currentJourneyRefs.filter(ref => !allRefsFromCurrentFetch.includes(ref));
  const itemsToBeRemoved = currentJourneyItems.filter(item => refsToBeRemoved.includes(item.ref));

  // Remove from state
  currentJourneyItems = currentJourneyItems.filter(item => !refsToBeRemoved.includes(item.ref));
  currentJourneyRefs  = currentJourneyRefs.filter(ref => !refsToBeRemoved.includes(ref)); // <-- fix: reassign

  // Remove from Cesium
  itemsToBeRemoved.forEach(item => viewer.entities.remove(item));

 

  currentJourneyItems.forEach(entity => {
    const fetchedJourney = existingJourneys.find(j => j.detailsReference === entity.ref);
    if (!fetchedJourney) return;

    const { longitude, latitude, height = 0 } = fetchedJourney;
    const nextPos = Cesium.Cartesian3.fromDegrees(longitude, latitude, height);

    // ensure time-dynamic position with HOLD extrapolation
    const spp = ensureSampledPosition(entity);
     // Smoothly update existing journeys
    const now = viewer.clock.currentTime;
    const future = Cesium.JulianDate.addSeconds(now, LOOKAHEAD_SEC, new Cesium.JulianDate());

    // ---- (4) Seed a sample at `now` if missing to avoid gaps
   const tinyPast = Cesium.JulianDate.addSeconds(now, -EPS, new Cesium.JulianDate());

    // if no value at 'now', add a trailing anchor just behind it
    if (!spp.getValue(now)) {
      const seed = (entity.position && entity.position.getValue)
        ? entity.position.getValue(now)
        : entity.position;
      if (seed) spp.addSample(tinyPast, seed);
    }

    // avoid micro-jitter
    const lastKnown = spp.getValue(now);
    if (!movedEnough(lastKnown, nextPos)) {
      relaxAvailability(entity, 60, 30);
      return;
    }

    // Add the next sample slightly beyond the poll interval
    addFutureSampleMonotonic(entity, future, nextPos);

    // Keep availability generous (prevents flicker)
    relaxAvailability(entity, 600, 120);

    // Occasionally trim old samples (every ~30s; cheap to call each tick)
    trimSamples(entity, 180);
  });

  // Add any new journeys and prep them for interpolation
  const newEntities = await visualizeJourneyPositions(newJourneys);
  newEntities.forEach(entity => {
    ensureSampledPosition(entity);
    relaxAvailability(entity, 600, 120);
  });

  // Update state
  currentJourneyItems = [...currentJourneyItems, ...newEntities];
  currentJourneyRefs  = [...currentJourneyRefs,  ...newJourneyRefs];

}


export function selectJourney(ref) {
  const originalPixelSize = 10
  const selectedPixelSize = 20
  currentJourneyItems.forEach(item => {
    item.point.pixelSize = item.ref === ref ? selectedPixelSize : originalPixelSize
  })
}





