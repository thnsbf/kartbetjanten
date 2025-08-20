import { viewer } from "../viewer.js";

let handlerVasttrafikHover = null

export function initializeVasttrafikHandlers() {
  handlerVasttrafikHover = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
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

  const handlerFunction = function (movement) {
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
  
  handlerVasttrafikHover.setInputAction(handlerFunction, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

}

export function removeVasttrafikHandlers() {
  handlerVasttrafikHover.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
  handlerVasttrafikHover.destroy()
}
