import { viewer } from "./viewer.js";

// KP-THN: Moved eventListener to js/index.js

// Function to take a screenshot
export function takeScreenshot() {
    viewer.render();
    const canvas = viewer.scene.canvas;
    const clock = viewer.clock;
    const timestamp = getFormattedTimestamp(clock.currentTime);
    const filename = `screenshot_${timestamp}.png`;
    canvas.toBlob(function (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    });
}

// Function to get formatted timestamp
function getFormattedTimestamp(time) {
    const date = new Date(time);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}
