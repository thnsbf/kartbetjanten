import { viewer } from "./viewer.js";

// KP-THN: Moved eventListener to js/index.js

export function shareView() {
    const camera = viewer.camera;
    const position = camera.positionCartographic;
    const longitude = Cesium.Math.toDegrees(position.longitude);
    const latitude = Cesium.Math.toDegrees(position.latitude);
    const height = position.height;
    const heading = Cesium.Math.toDegrees(camera.heading);
    const pitch = Cesium.Math.toDegrees(camera.pitch);
    const roll = Cesium.Math.toDegrees(camera.roll);

    // Construct the shareable link
    const baseUrl = window.location.href.split('#')[0].split('?')[0]; // Remove any existing hash and query parameters
    const shareableLink = baseUrl +
        `?longitude=${longitude}&latitude=${latitude}&height=${height}&heading=${heading}&pitch=${pitch}&roll=${roll}`;

    // Copy the link to clipboard
    copyToClipboard(shareableLink);

    // Inform the user that the link has been copied
    alert("Länk kopierad till urklipp:\n" + shareableLink);

    // Replace the current URL without adding a new entry to the browser's history
    window.history.replaceState({}, document.title, shareableLink);
}


// Function to copy text to clipboard
function copyToClipboard(text) {
    const tempInput = document.createElement("input");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
}

// Function to read URL parameters and set camera position
function readAndSetCameraPosition() {
    const urlParams = new URLSearchParams(window.location.search);
    const longitude = parseFloat(urlParams.get('longitude'));
    const latitude = parseFloat(urlParams.get('latitude'));
    const height = parseFloat(urlParams.get('height'));
    const heading = parseFloat(urlParams.get('heading'));
    const pitch = parseFloat(urlParams.get('pitch'));
    const roll = parseFloat(urlParams.get('roll'));

    if (!isNaN(longitude) && !isNaN(latitude) && !isNaN(height) &&
        !isNaN(heading) && !isNaN(pitch) && !isNaN(roll)) {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
            orientation: {
                heading: Cesium.Math.toRadians(heading),
                pitch: Cesium.Math.toRadians(pitch),
                roll: Cesium.Math.toRadians(roll),
            },
        });
    }
}
// Call readAndSetCameraPosition on page load
setTimeout(function() {
    // Call readAndSetCameraPosition after 1.5 seconds
    readAndSetCameraPosition();
}, 1500);