/* Feature hiding on middle click */
////////////////////////////////////
import { viewer } from "./viewer.js";
const viewModel = {
  middleClickAction: "hide" // Set the initial value as "hide" or another action
};

const scene = viewer.scene;
if (!scene.pickPositionSupported) {
  window.alert("This browser does not support pickPosition.");
}

const hiddenFeatures = []; // Array to store hidden features
export function initializeHideBuildings() {
  const hideHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

  hideHandler.setInputAction(function (movement) {
  const feature = scene.pick(movement.position);
  if (!Cesium.defined(feature)) {
    return;
  }

  const action = viewModel.middleClickAction;
  if (action === "hide") {
    feature.show = false;
    hiddenFeatures.push(feature); // Add the hidden feature to the array
  }
}, Cesium.ScreenSpaceEventType.MIDDLE_CLICK);

}

// Function to restore hidden features
export function restoreHiddenFeatures() {
  hiddenFeatures.forEach((feature) => {
    feature.show = true; // Set the feature to be visible again
  });
  hiddenFeatures.length = 0; // Clear the hidden features list after restoring
}


