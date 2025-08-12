import { responsiveAriaVisibility } from "./responsiveness.js";
import { takeScreenshot } from "./print.js";
import { shareView } from "./share-position.js"
import { enterPedestrianMode, exitPedestrianMode, minimizeMaximizeToggle } from "./pedestrian-mode.js"
import { viewProject } from "./projects.js";
import { toggleDrawing, removeAllPolygons, slider, heightValue } from "./extruded-polygons-tool.js";
import { restoreHiddenFeatures } from "./hide-buildings.js";
import { toggleTooltip } from "./tooltips.js";
import { handleViewshedClick, handleClearViewshedClick } from "./viewshed.js";
import { drawLine } from "./terrain-section.js"
import { handleStartShader, handleClearShader, handleCancelShader } from "./sensor-shadow/sensor-shadow.js";
import { viewer } from "./viewer.js";


export function initializeEventListeners() {
  // Event listener for tooltip buttons

document.getElementById("tooltip-draw-polygon-btn").addEventListener("click", function () {
  toggleTooltip('tooltip-draw-polygon');
});

document.getElementById("tooltip-solar-study-btn").addEventListener("click", function () {
  toggleTooltip('tooltip-solar-study');
});
document.getElementById("tooltip-measure-tools-btn").addEventListener("click", function () {
  toggleTooltip('tooltip-measure-tools');
});
document.getElementById("tooltip-viewshed-btn").addEventListener("click", function () {
  toggleTooltip('tooltip-viewshed');
});
document.getElementById("tooltip-section-tool-btn").addEventListener("click", function () {
  toggleTooltip('tooltip-section-tool');
});
document.getElementById("tooltip-shader-btn").addEventListener("click", function () {
  toggleTooltip('tooltip-shader');
});


// Event listener for screenshot button

document.getElementById("printBtn").addEventListener("click", function () {
  takeScreenshot();
});

// Event listener for share button
document.getElementById("shareBtn").addEventListener("click", function () {
  shareView();
});

// Event listeners for buttons
document.getElementById("pedestrianModeBtn").addEventListener("click", function () {
  enterPedestrianMode();
  var cesiumToolbar = document.querySelector(".cesium-viewer-toolbar");
  cesiumToolbar.classList.toggle('hidden');
});

document.getElementById("exitPedestrianModeBtn").addEventListener("click", function () {
  exitPedestrianMode();
  var cesiumToolbar = document.querySelector(".cesium-viewer-toolbar");
  cesiumToolbar.classList.toggle('hidden');
});
document.getElementById("ped-x-close-btn").addEventListener("click", function () {
  exitPedestrianMode();
  var cesiumToolbar = document.querySelector(".cesium-viewer-toolbar");
  cesiumToolbar.classList.toggle('hidden');
});

document.getElementById("minimizePedestrianModeBtn").addEventListener("click", function () {
  minimizeMaximizeToggle();
});
document.getElementById("ped-minus-btn").addEventListener("click", function () {
  minimizeMaximizeToggle();
  
});

// Update the extrusion height label when slider changes
slider.addEventListener('input', function() {
  heightValue.textContent = slider.value;
});
// Attach event listeners to the buttons
document.getElementById('removeExtrudeDrawingButton').addEventListener('click', removeAllPolygons);
document.getElementById('startExtrudeDrawingButton').addEventListener('click', toggleDrawing);
document.getElementById('start-viewshed-btn').addEventListener('click', handleViewshedClick );
document.getElementById('clear-viewshed-btn').addEventListener('click', handleClearViewshedClick );
document.getElementById("drawLineButton").addEventListener("click", drawLine);

// Shader-verktyget

document.getElementById('start-shader-btn').addEventListener('click', () => handleStartShader(viewer));
document.getElementById('clear-shader-btn').addEventListener('click', () => handleClearShader(viewer));
document.getElementById('cancel-shader-btn').addEventListener('click', () => handleCancelShader(viewer));


// Zoom-functions



// Add event listener to the reset button
document.getElementById('resetBuildings').addEventListener('click', restoreHiddenFeatures);

// Aria hidden responsive
window.addEventListener('resize', responsiveAriaVisibility);




}