let isPedestrianMode = false;
let pedestrianClickHandler;
let isMinimized = false

// Import your viewer (assuming it's a Cesium viewer)
import { viewer } from "./viewer.js";
import { updateAriaVisibility } from "./aria.js";
const h5 = document.getElementById("ped-h5");

// Function to toggle the display of the buttons
function toggleButtonDisplay(showDrawingButtons) {
    const exitPedestrianModeButton = document.getElementById("exitPedestrianModeBtn");
    const minimizePedestrianModeButton = document.getElementById("minimizePedestrianModeBtn");

    const pedestrianModeWrapper = document.querySelector(".pedestrian-mode-wrapper");
    const navbar = document.querySelector(".navbar");
    const header = document.getElementById("header");
    const navigationMixin = document.querySelector(".cesium-widget-cesiumNavigationContainer");
    const pedestrianInfo = document.getElementById('pedestrian-info');

    if (showDrawingButtons) {
        pedestrianModeWrapper.style.display = "none";
        navigationMixin.style.display = "block";
    } else {
        exitPedestrianModeButton.style.display = "block flex";
        minimizePedestrianModeButton.style.display = "block flex";
        h5.style.display = "block"
        h5.style.visibility = "visible"
        pedestrianInfo.style.display = "block"
        navigationMixin.style.display = "none"; 
        pedestrianModeWrapper.style.display = "block flex";
    }
}

export function minimizeMaximizeToggle() {
    if (!isPedestrianMode) return
    const pedestrianModeModal = document.getElementById("pedestrianModeInfo")
    const exitPedestrianModeButton = document.getElementById("exitPedestrianModeBtn");
    const minimizePedestrianModeButton = document.getElementById("minimizePedestrianModeBtn");
    const pedestrianInfo = document.getElementById('pedestrian-info');
    const xClose = document.getElementById('ped-x-close-btn')
    const minusMinimizeImg = document.getElementById('ped-minus-btn__img')
    const minusMinimize = document.getElementById('ped-minus-btn')
    if (exitPedestrianModeButton.style.display === "none") {

        exitPedestrianModeButton.style.display = "block flex";
        minimizePedestrianModeButton.style.display = "block flex";
        h5.style.display = "block"
        h5.style.visibility = "visible"
        pedestrianInfo.style.display = "block"
        minusMinimizeImg.src = "/img/minus-purple.svg"

    } else {

        exitPedestrianModeButton.style.display = "none";
        minimizePedestrianModeButton.style.display = "none";
        h5.style.display = "none"
        h5.style.visibility = "none"
        pedestrianInfo.style.display = "none"
        minusMinimizeImg.src = "/img/icon-kommun-arrow-purple.svg"
    }
    pedestrianModeModal.classList.toggle('pedestrian-mode-wrapper--minimized')
    xClose.classList.toggle('x-btn--minimized')
    minusMinimize.classList.toggle('minus-btn--minimized')
}

// Functions for entering and exiting pedestrian mode
export function enterPedestrianMode() {
    toggleButtonDisplay(false); // Hide other buttons
    isPedestrianMode = true;

    updateAriaVisibility('pedestrianModeInfo', 'false');

    // Disable camera controls to prevent camera movement
    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = false;
    viewer.scene.screenSpaceCameraController.enableTilt = false;

    // Set up the click handler for pedestrian mode
    pedestrianClickHandler = viewer.screenSpaceEventHandler.getInputAction(
        Cesium.ScreenSpaceEventType.LEFT_CLICK
    );
    viewer.screenSpaceEventHandler.setInputAction(handlePedestrianClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

export function exitPedestrianMode() {
    toggleButtonDisplay(true); // Show other buttons
    isPedestrianMode = false;
    const pedestrianModeModal = document.getElementById("pedestrianModeInfo")
    pedestrianModeModal.classList.remove('pedestrian-mode-wrapper--minimized')
    const xClose = document.getElementById('ped-x-close-btn')
    xClose.classList.remove('x-btn--minimized')
    const pedMinus = document.getElementById('ped-minus-btn')
    pedMinus.classList.remove('minus-btn--minimized')
    const minusMinimizeImg = document.getElementById('ped-minus-btn__img')
    minusMinimizeImg.src = "/img/minus-purple.svg"
    updateAriaVisibility('pedestrianModeInfo', 'true');

    // Enable camera controls to allow camera movement
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
    viewer.scene.screenSpaceCameraController.enableTilt = true;

    // Remove the pedestrian click handler
    if (pedestrianClickHandler) {
        viewer.screenSpaceEventHandler.setInputAction(pedestrianClickHandler, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        pedestrianClickHandler = undefined;
    }
}

// Handle pedestrian click
function handlePedestrianClick(event) {
    if (isPedestrianMode) {
        const ray = viewer.camera.getPickRay(event.position);
        const intersection = viewer.scene.pickFromRay(ray);
        if (Cesium.defined(intersection) && Cesium.defined(intersection.position)) {
            const newPosition = intersection.position;
            const currentHeading = viewer.camera.heading;

            viewer.camera.flyTo({
                destination: newPosition,
                orientation: {
                    heading: currentHeading,
                    pitch: Cesium.Math.toRadians(0),
                    roll: Cesium.Math.toRadians(0)
                },
                complete: function () {
                    const cartographicPosition = Cesium.Cartographic.fromCartesian(newPosition);
                    cartographicPosition.height += 1.75;
                    const newHeightPosition = Cesium.Cartesian3.fromRadians(
                        cartographicPosition.longitude,
                        cartographicPosition.latitude,
                        cartographicPosition.height
                    );
                    viewer.camera.setView({
                        destination: newHeightPosition,
                        orientation: {
                            heading: currentHeading,
                            pitch: Cesium.Math.toRadians(0),
                        },
                    });
                },
            });
        }
    }
}
