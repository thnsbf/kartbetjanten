import { viewer } from "../viewer.js";

let handlerAIS = null

export function deInitializeAISHandlers() {
  handlerAIS.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
  handlerAIS.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
  handlerAIS.destroy()
}

export function initializeAISHandlers() {
  handlerAIS = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  let currentlyHovered = null  
  
  const popUpElem = document.createElement('div')
  popUpElem.id = "ais-hover-popup"
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
      pickedObject.id?.isAISVehicle &&
      currentlyHovered !== pickedObject.id.ref
    ) {

      const tooltip = document.getElementById("ais-hover-popup");
      
      tooltip.style.left = movement.endPosition.x + 10 + "px";
      tooltip.style.top = movement.endPosition.y + 10 + "px";
      
      tooltip.innerHTML = `
        Last seen: ${getLastSeenTime(pickedObject.id?.millis)}<br>
        Name: ${pickedObject.id.name}<br>
        Vessel type: ${pickedObject.id?.shipType}<br>
        Heading: ${pickedObject.id?.head}<br>
        MMSI: ${pickedObject?.id?.mmsi}
      `;
      tooltip.style.display = "block";
    } else if (Cesium.defined(pickedObject) && currentlyHovered !== null && currentlyHovered === pickedObject.id?.ref) {
      // Do Nothing
    } else {
      const tooltip = document.getElementById("ais-hover-popup");
      tooltip.style.display = "none";
      currentlyHovered = null
    }
  }

  function getLastSeenTime(millis) {
    const lastSeenTime = new Date(millis)
    const now = new Date().getTime()
    const lastSeenDiff = now - lastSeenTime
    const mins = convertMiliseconds(lastSeenDiff, "m")
    const ms = mins === 1 ? "" : "s"
    if (mins < 60){ 
      return `${mins} min${ms} ago`
    } else if (convertMiliseconds(lastSeenDiff, "h") < 25) {
      const hours = convertMiliseconds(lastSeenDiff, "h")
      const hs = hours == 1 ? "" : "s"
      return `${hours} hour${hs} ago`
    } else {
      const days = convertMiliseconds(lastSeenDiff, "d")
      const ds = days == 1 ? "" : "s"
      return `${days} day${ds} ago`
    }
  }

  const clickFunction = function(click) {
    const pickedObject = viewer.scene.pick(click.position);
    if (Cesium.defined(pickedObject) && pickedObject.id?.isAISVehicle) {
      
    } else {
      
    }
  }
  
  handlerAIS.setInputAction(hoverFunction, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  handlerAIS.setInputAction(clickFunction, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

export function removeAISHandlers() {
  handlerAIS.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
  handlerAIS.destroy()
}


function convertMiliseconds(miliseconds, format) {
  var days, hours, minutes, seconds, total_hours, total_minutes, total_seconds;
  
  total_seconds = parseInt(Math.floor(miliseconds / 1000));
  total_minutes = parseInt(Math.floor(total_seconds / 60));
  total_hours = parseInt(Math.floor(total_minutes / 60));
  days = parseInt(Math.floor(total_hours / 24));

  seconds = parseInt(total_seconds % 60);
  minutes = parseInt(total_minutes % 60);
  hours = parseInt(total_hours % 24);
  
  switch(format) {
	case 's':
		return total_seconds;
	case 'm':
		return total_minutes;
	case 'h':
		return total_hours;
	case 'd':
		return days;
	default:
		return { d: days, h: hours, m: minutes, s: seconds };
  }
};