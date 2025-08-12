import { viewer } from "./viewer.js";

export function initializeMouseCoordinates() {

// Definera projectioner 
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs");
// Byt till ert lokala system, på epsg.io finns det färdiga proj4.defs under proj4js
proj4.defs("EPSG:3007", "+proj=tmerc +lat_0=0 +lon_0=12 +k=1 +x_0=150000 +y_0=0 +ellps=GRS80 +units=m +no_defs");

//Se till att byta på alla ställen där "EPSG:3010" refereras

// Function to detect if the user is on a mobile device
function isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent) || window.matchMedia("(max-width: 767px)").matches;
}

// Check if the user is not on a mobile device
if (!isMobile()) {
    // Dynamically create the coordinates div if not on mobile
    var coordinatesDiv = document.createElement('div');
    coordinatesDiv.id = 'coordinates';

    // Find the cesiumContainer div and append the coordinates div to it
    var cesiumContainer = document.getElementById('cesiumContainer');
    if (cesiumContainer) {
        cesiumContainer.appendChild(coordinatesDiv);
    } else {
        console.error('Could not find cesiumContainer div.');
    }

    // Run your code if it's not a mobile device
    viewer.entities.add({
        id: 'mou',
        label: {
            show: true,
        },
        isMou: true
    });

    viewer.scene.canvas.addEventListener('mousemove', function(e) {
        var entity = viewer.entities.getById('mou');

        // Mouse over the globe to see the cartographic position 
        var ray = viewer.camera.getPickRay(new Cesium.Cartesian2(e.clientX, e.clientY));
        var cartesian = viewer.scene.globe.pick(ray, viewer.scene);

        if (cartesian) {
            // Use sampleTerrainMostDetailed to get accurate terrain height
            Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [cartesian])
                .then((updatedPositions) => {
                    let accurateCartesian = updatedPositions[0];
                    let cartographic = Cesium.Cartographic.fromCartesian(accurateCartesian);
                    // Convert the coordinates
                    let sourceCoord = [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)];

                    let targetCoordSweref1630 = proj4("EPSG:4326", "EPSG:3007", sourceCoord);

                    // Get height from Cartographic object
                    let height = cartographic.height;

                    entity.position = accurateCartesian;
                    entity.label.show = false;
                    entity.label.font_style = 84;

                    // Include height in the label
                    // Byt label till ert koordinatsystem
                    entity.label.text = `SWEREF 99 12 00, E: ${targetCoordSweref1630[0].toFixed(3)}, N: ${targetCoordSweref1630[1].toFixed(3)}, Height: ${height.toFixed(2)} m
                        ..... ${sourceCoord[0]} , ${sourceCoord[1]}
                    `;

                    // Update the dynamically created div with the coordinates information
                    document.getElementById("coordinates").innerHTML = entity.label.text;
                })
                .catch((error) => {
                    console.error("Error sampling terrain: ", error);
                });
        } else {
            entity.label.show = false;
        }
    });
}

}