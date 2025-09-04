import { viewer } from "../viewer.js";
import { showJourneyInfo, removeExistingJourneyInfoElem } from "./vasttrafik-dom.js";
import { selectJourney } from "./vasttrafik.js";
import { startSpeedTracker, stopSpeedTracker } from "./vasttrafik-speed.js";

let handlerVasttrafik = null

export function initializeVasttrafikHandlers() {
  handlerVasttrafik = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  let currentlyHovered = null  
  
  const popUpElem = document.createElement('div')
  popUpElem.id = "vasttrafik-hover-popup"
  popUpElem.style = `
    display: none; 
    position: absolute; 
    background: var(--c-background-popup-hover); 
    padding: 5px; 
    border: 1px solid #ccc; 
    font-size: 12px;
    `
  document.body.appendChild(popUpElem)

  const hoverFunction = function (movement) {
    const pickedObject = viewer.scene.pick(movement.endPosition);  
    if (
      Cesium.defined(pickedObject) &&
      pickedObject.id?.isVasttrafikVehicle &&
      currentlyHovered !== pickedObject.id.ref
    ) {
      const tooltip = document.getElementById("vasttrafik-hover-popup");
      currentlyHovered = pickedObject.id?.ref
      const transpMode = pickedObject.id.line.transportMode
      const vehicleType = transpMode === "bus" ? "Buss" : transpMode === "tram" ? "Spårvagn" : transpMode === "train" ? "Tåg" : transpMode === "ferry" ? "Båt" : transpMode === "taxi" ? "Taxi" : "Okänt färdmedel"
      tooltip.style.left = movement.endPosition.x + 10 + "px";
      tooltip.style.top = movement.endPosition.y + 10 + "px";
      tooltip.innerHTML = `
        ${vehicleType}: ${pickedObject.id.line.name}
      `;
      tooltip.style.display = "block";
    } else if (Cesium.defined(pickedObject) && currentlyHovered !== null && currentlyHovered === pickedObject.id?.ref) {
      // Do Nothing
    } else {
      const tooltip = document.getElementById("vasttrafik-hover-popup");
      tooltip.style.display = "none";
      currentlyHovered = null
    }
  }

  const clickFunction = function(click) {
    const pickedObject = viewer.scene.pick(click.position);
    if (Cesium.defined(pickedObject) && pickedObject.id?.isVasttrafikVehicle) {
      stopSpeedTracker()
      showJourneyInfo(pickedObject.id)
      selectJourney(pickedObject.id.ref)
      startSpeedTracker(pickedObject.id)
    } else {
      selectJourney('')
      removeExistingJourneyInfoElem()
      stopSpeedTracker()
    }
  }
  
  handlerVasttrafik.setInputAction(hoverFunction, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  handlerVasttrafik.setInputAction(clickFunction, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

export function removeVasttrafikHandlers() {
  handlerVasttrafik.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
  handlerVasttrafik.destroy()
}
