import { viewer } from "./viewer.js";

var arrViewField = [];
var viewModels = { verticalAngle: 90, horizontalAngle: 120, distance: 10 };



function clearAllViewField() {
    for (var e = 0, i = arrViewField.length; e < i; e++) {
        arrViewField[e].destroy()
    }
    arrViewField = []
}


export function handleViewshedClick() {
  console.log(document.getElementById('start-viewshed-btn').textContent.trim())
  const isOff = document.getElementById('start-viewshed-btn').textContent.trim().toLowerCase() === "aktivera siktverktyget"
  setvisible(isOff ? "add" : "remove")
  document.getElementById('start-viewshed-btn').textContent = isOff ? "Avaktivera siktverktyget" : "Aktivera siktverktyget"

}

export function handleClearViewshedClick() {
  setvisible('destroy')
}

function setvisible(value) {
    switch (value) { 
        case 'add':
          activateViewshed()
          break;
        case 'remove':
          deactivateViewshed()
          break;
        case 'destroy':
          //  remove cesium click handler
          clearAllViewField();
          break
    }
}



function activateViewshed() {


  var e = new Cesium.ViewShed3D(viewer, {
      horizontalAngle: Number(viewModels.horizontalAngle),
      verticalAngle: Number(viewModels.verticalAngle),
      distance: Number(viewModels.distance),
      calback: function () {
          viewModels.distance = e.distance
      }
  });
  arrViewField.push(e)
  }

function deactivateViewshed() {
  if (viewshedClickHandler) {
      viewshedClickHandler.destroy(); // Remove the click handler
      viewshedClickHandler = null;
      console.log("Viewshed deactivated!");
  }
}

