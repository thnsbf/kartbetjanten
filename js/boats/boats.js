import { viewer } from '../viewer.js';
import { openAisSSE } from './get-ais-jwt-and-connect.js';
import { deInitializeAISHandlers, initializeAISHandlers } from './boats-handlers.js';
import { boatMap3Dmodels } from './boats-3d.js';
import { createBridgesElem } from './boats-bridges.js';
import { addZonesAsRectangles } from './boats-testing.js';

const URL = 'http://localhost:8080'

// MMSI (or name) -> Cesium.Entity
const boats = new Map();
const STALE_SECONDS = 5 * 60; // optional cleanup
const optional = {
    rotationOffset: 20
  }
let initialBridgeState = null
let initialBoatState = null

// Simple blue triangle (points UP in the SVG = North)
const ARROW_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <!-- Nose at (20,3), side points at (36,28) & (4,28), tail tip at (20,20) -->
  <polygon points="20,3 30,28 20,20 10,28"
           fill="#2E86DE"
           stroke="#1B4F72"
           stroke-width="2"
           stroke-linejoin="round"/>
</svg>`;
const ARROW_IMAGE = `data:image/svg+xml,${encodeURIComponent(ARROW_SVG)}`;

viewer.clock.shouldAnimate = true;
viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
viewer.clock.multiplier = 1;

  const ZONES = {
    "StallbackaZon": [[58.30533317, 12.30906696], [58.33590903, 12.35088104]],
    "StallbackaZonSydVast": [[58.29650919, 12.29859167], [58.30533400, 12.31240251]],
    "StridsbergZonOst": [[58.29555908, 12.29746029], [58.29650962, 12.30367370]], 
    "StridsbergZonNord": [[58.29355485, 12.29397968], [58.29556047, 12.29946348]],
    "StridsbergZonSyd": [[58.29264338, 12.29309587], [58.29355611, 12.29543779]], 
    "JarnvagZonNord": [[58.29180295, 12.29185576], [58.29264380, 12.29436019]],
    "JarnvagZonSyd": [[58.29027788, 12.29094935], [58.29180347, 12.29340627]], 
    "JarnvagZonSydVast": [[58.29029413, 12.29021222], [58.29101638, 12.29094963]], 
    "SpikZonNord": [[58.28898007, 12.28848161], [58.29030114, 12.29118872]],  
    "SpikZonMid": [[58.28799108, 12.28700708], [58.28898020, 12.28996469]],   
    "SpikZonSyd": [[58.28659588, 12.28533902], [58.28799224, 12.28902224]],   
    "KlaffZonNord": [[58.28413980, 12.28362654], [58.28659660, 12.28684240]], 
    "KlaffZonSyd": [[58.28186881, 12.28295961], [58.28414242, 12.28445888]],
    "KanalZonNord": [[58.27863928, 12.28085731], [58.28187136, 12.28369943]], 
    "KanalZonSyd": [[58.27521023, 12.27863656], [58.27864830, 12.28266269]], 
    "OlideZonNord": [[58.27285332, 12.27477977], [58.27521877, 12.28145821]],
    "OlideZonSyd": [[58.26865938, 12.26954330], [58.27286714, 12.27586029]],
    "Akerssjo": [[58.26585942, 12.26847350], [58.26866909, 12.27049840]]
  }

// addZonesAsRectangles(viewer, ZONES)
const { es } = await openAisSSE(URL, onAisMessage);
  console.log('AIS SSE connected:', es.url);

export async function initializeBoats() {
  initializeAISHandlers();
  if (initialBoatState) addOrUpdateBoats(initialBoatState)
}

export function deInitializeBoats() {
  deInitializeAISHandlers()
  removeAllBoats()
}

export async function initializeBoatApi() {
  
}

export async function initializeBridges() {
  if (initialBridgeState) createBridgesElem(initialBridgeState)
}

export function deInitializeBridges() {
  const currentElem = document.getElementById('bridges-wrapper')
  if (currentElem) currentElem.remove()
}

function addOrUpdateBoats(items) {
  for (const m of items) {
    // Expect: { mmsi, name, lat, lon, head?, cog?, ts }
    if (m == null || typeof m.lat !== 'number' || typeof m.lon !== 'number') continue;

    const id = m.mmsi ? String(m.mmsi) : (m.name ? String(m.name) : null);
    if (!id) continue;

    const entity = boats.get(id) || addNewBoat(id, m);
    updateBoat(entity, m);
  }
}


function onAisMessage(payload) {
  if (!payload) return;
  const type = Array.isArray(payload) ? "boat-update" : payload.id
  const items = Array.isArray(payload) ? payload : [payload];
  console.log(items)
  if (type === "boat-update") {
    const checkbox = document.getElementById("view-checkbox-battrafik")
    if (!checkbox || !checkbox.checked) {
      initialBoatState = [...items]
      return
    }
    addOrUpdateBoats(items)

  } else if (type === "bridge-update") {
    const checkbox = document.getElementById("view-checkbox-brooppningar")
    if (checkbox && checkbox.checked) {
      // Client has the bridge-opening-module activated in the browser. Any updates from server
      // will be shown directly in the browser.
      initialBridgeState = payload
      createBridgesElem(payload)
    } else {
      // Client does not have bridge-opening-module activated, bridge-update from server will be
      // saved in local variable initialBridgeState if user opens module at a later time
      initialBridgeState = payload
    }
  }
}

function addNewBoat(id, m) {
  const boatInBoatMap3D = boatMap3Dmodels.get(m.shipType)
  const elevation = boatInBoatMap3D?.elevation
  const pos = Cesium.Cartesian3.fromDegrees(m.lon, m.lat, elevation || 0)

  const hdg = typeof m.head === 'number' && m.head !== 511 ? m.head
            : typeof m.cog  === 'number' ? m.cog : undefined;
  const entityObj = {
    id,
    mmsi: m.mmsi ?? "",
    name: m.name || id,
    position: pos,
    head: hdg,
    isAISVehicle: true,
    shipType: m.shipType || undefined,
    millis: m.ts, // exact from API
    billboard: {
      image: ARROW_IMAGE,
      width: 32,
      height: 32,
      rotation: (typeof m.head === 'number' && m.head != 511 ? billboardRotationFromHeading(m.head)
               : typeof m.cog  === 'number' ? billboardRotationFromHeading(m.cog)
               : 0),
      alignedAxis: Cesium.Cartesian3.UNIT_Z,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND, 
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    },
    /* label: {
      text: m.name ? `${m.name} (${id})` : id,
      font: '12px sans-serif',
      pixelOffset: new Cesium.Cartesian2(0, -24),
      showBackground: true,
      disableDepthTestDistance: Number.POSITIVE_INFINITY
    }, */
    description: 'AIS vessel'
  }
  if (m.hasOwnProperty("shipType") && boatInBoatMap3D) {
    const { uri, scale } = boatInBoatMap3D
    const model = {
      uri: uri,
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      // Let scale control size; no floor/cap fighting it
      minimumPixelSize: 0,
      // Constant scales you were using (adjust to taste)
      scale: scale || 1,
      runAnimations: false,
      upAxis: Cesium.Axis.Y,
      forwardAxis: Cesium.Axis.Z_NEGATIVE,
    }
    entityObj.model = model
    
  }
  
  const entity = viewer.entities.add(entityObj);
  if (typeof hdg === 'number') {
    entity.orientation = modelOrientationFromHeading(pos, hdg, 0);
  }

  boats.set(id, entity);
  return entity;
}

function updateBoat(entity, m) {
  const boatInBoatMap3D = boatMap3Dmodels.get(m.shipType)  
  const elevation = boatInBoatMap3D?.elevation
  const pos = Cesium.Cartesian3.fromDegrees(m.lon, m.lat, elevation || 0);
  entity.position = pos;
  entity.millis = m.ts;
  const hdg = typeof m.head === 'number' && m.head !== 511 ? m.head
            : typeof m.cog  === 'number' ? m.cog : undefined;

  
  if (typeof hdg === 'number') {
    entity.orientation = modelOrientationFromHeading(pos, hdg, 0);
  }

  // Update arrow rotation
  if (entity.billboard && typeof hdg === 'number') {
    entity.billboard.rotation = billboardRotationFromHeading(hdg);
  }

  if (m.name && entity.label) {
    entity.label.text = `${m.name} (${entity.id})`;
  }
}


function removeStaleBoats() {
  const cutoff = Date.now() - STALE_SECONDS * 1000;
  for (const [id, entity] of boats) {
    if (typeof entity.millis === 'number' && entity.millis < cutoff) {
      viewer.entities.remove(entity);
      boats.delete(id);
    }
  }
}

/* --- helpers --- */

// CCW-from-East yaw used by Cesium HPR
function yawFromCompassHeading(headingDeg) {
  // compass heading is CW-from-North → convert to CCW-from-East
  return Cesium.Math.toRadians(90 - headingDeg);
}

// Billboard: your SVG points UP (north) at rotation=0.
// Billboard.rotation is CCW-from-East, so subtract 90°.
function billboardRotationFromHeading(headingDeg) {
  return yawFromCompassHeading(headingDeg) - Cesium.Math.PI_OVER_TWO; // == -rad(heading)
}

// Model: build quaternion at THIS position (ENU changes with position).
// If your model's "forward" isn't what you've declared below, tweak modelYawOffsetDeg.
function modelOrientationFromHeading(positionCartesian, headingDeg, modelYawOffsetDeg = 0) {
  const yaw = yawFromCompassHeading(headingDeg) + Cesium.Math.toRadians(headingDeg * 2);
  const hpr = new Cesium.HeadingPitchRoll(yaw, 0.0, 0.0);
  return Cesium.Transforms.headingPitchRollQuaternion(positionCartesian, hpr);
}


function removeAllBoats() {
  boats.forEach((entity, id, state) => {
    viewer.entities.remove(entity);
    state.delete(id);
  })
}