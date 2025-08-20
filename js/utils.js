import { flyToLoc } from "./zoom-functions.js";
import { defaultCheckProject } from "./projects.js";

export async function readJson(url) {
  try {
    const jsonUrl = new URL(url, import.meta.url);
    const response = await fetch(jsonUrl);
    return await response.json();
  } catch (error) {
    console.error(`Error loading JSON-file with url ${url}:`, error);
  }
}

export async function initialCameraView(projectsJsonUrl) {
  
  const projectCoordinates = []
  let projectId = null
  const json = await readJson(projectsJsonUrl)
  for (const feature of json.features) {
    if (feature.properties.defaultCheckProject) {
      const [lat, lon] = feature.geometry.coordinates
      const { heading, pitch, roll } = feature.properties.camera.orientation
      const alt = feature.properties.camera.altitude
      projectCoordinates.push(lat, lon, alt, heading, pitch, roll)
      projectId = feature.properties.id
      break
    }
  }
  if (projectId) {
    defaultCheckProject(projectId)
    flyToLoc(...projectCoordinates)
  } else {
    const globals = await readJson("../json/globals.json")
    const settings = globals.cesiumCamera.defaultSettings
    const defaultCoordinates = []
    for (const key in settings) {
      defaultCoordinates.push(settings[key])
    }
    flyToLoc(...defaultCoordinates)
  }
}


export function getDarkerCesiumColor(colObj, reduceFactor = 0.33) {

  const { red, green, blue, alpha } = colObj
  const newValues = [
    toByte(red - reduceFactor),
    toByte(green - reduceFactor),
    toByte(blue - reduceFactor),
    toByte(alpha)
  ]
  return Cesium.Color.fromBytes(...newValues)
}

function toByte(decimalValue) {
  const newValue = decimalValue * 255
  return newValue < 0 ? 0 : Math.round(newValue)
}

export function fromDecimalsToBytes(colObj) {
  const { red, green, blue, alpha } = colObj
  const newValues = [
    toByte(red),
    toByte(green),
    toByte(blue),
    toByte(alpha)
  ]
  return Cesium.Color.fromBytes(...newValues)
}

export function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}
