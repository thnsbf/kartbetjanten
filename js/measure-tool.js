import { viewer, toggleInfoBoxClickActivated } from "./viewer.js";
import { CESIUM_COLORS } from "./colors/colors.js";

// Disable the default double-click action
viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
viewer.scene.globe.depthTestAgainstTerrain = true;

var allLines = []; // Array to store all line entities
var allPoints = []; // Array to store all point entities
var allLabels = []; // Array to store all label entities
var allAreas = []; // Array to store all area entities
let activeAreaPoints = [] // Array to store areaPoints
var currentPositions = []; // Positions for the current line or area
var currentPolyline;
var currentDynamicPoint;
var currentAreaPolygon;
var areaLabelEntity; // Store the dynamic area label entity
var isFirstPointPlaced = false;
export var isMeasuring = false; // Flag to control line measurement mode
export var isMeasuringArea = false; // Flag to control area measurement mode
export var isMeasuringHeight = false; // Flag to control area measurement mode

var handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
const pixelOffsetRegular = [0, 0]
const pixelOffsetMove = [95, 10]

var label = {
    font: '14pt Barlow',
    showBackground: true,
    horizontalOrigin: Cesium.HorizontalOrigin.TOP,
    verticalOrigin: Cesium.VerticalOrigin.TOP,
    pixelOffset: new Cesium.Cartesian2(...pixelOffsetRegular),
    eyeOffset: new Cesium.Cartesian3(0, 0, -10),
    fillColor: CESIUM_COLORS.WHITE,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,  // Lägger alltid label framför terräng/tileset  
};


export function initializeMeasureTools() {
    
    handler.setInputAction(function (movement) {
        var cartesian = viewer.scene.pickPosition(movement.endPosition);
        if (Cesium.defined(cartesian)) {
            if (isMeasuring) {
                if (isFirstPointPlaced) {
                    if (currentDynamicPoint) {
                        viewer.entities.remove(currentDynamicPoint);
                    }
                    currentDynamicPoint = viewer.entities.add({
                        position: cartesian,
                    });
                    if (currentPositions.length > 0) {
                        var extendedPositions = currentPositions.concat([cartesian]);
                        drawLine(extendedPositions);
                    }
                    var cumulativeLength = calculateDrapedLineLength(currentPositions.concat([cartesian]));
                    updateDynamicLabel(cartesian, cumulativeLength);
                }
            } else if (isMeasuringArea) {
                if (currentPositions.length > 0) {
                    var extendedPositions = currentPositions.concat([cartesian]);
                    drawArea(extendedPositions);
                    var area = calculatePolygonArea(extendedPositions);
                    updateAreaLabel(cartesian, area);
                }
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    
    handler.setInputAction(function (movement) {
        var cartesian = viewer.scene.pickPosition(movement.position);
        if (Cesium.defined(cartesian)) {
            if (isMeasuring || isMeasuringArea) {
                currentPositions.push(cartesian);
                if (isMeasuring) {
                    addPoint(cartesian, calculateDrapedLineLength(currentPositions));
                    drawLine(currentPositions);
                    if (currentDynamicPoint) {
                        viewer.entities.remove(currentDynamicPoint);
                    }
                    isFirstPointPlaced = true;
                } else if (isMeasuringArea) {
                    if (currentAreaPolygon) {
                        viewer.entities.remove(currentAreaPolygon);
                    }
                    createPoint(cartesian)
                    drawArea(currentPositions.concat([cartesian]));
                    var area = calculatePolygonArea(currentPositions.concat([cartesian]));
                    updateAreaLabel(cartesian, area);
                }
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
    handler.setInputAction(function () {
        if (isMeasuring) {
            finishLine();
        } else if (isMeasuringArea) {
            finishArea();
        }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // Attach event listeners to the buttons
    document.getElementById('measureButton').addEventListener('click', function() {
        isMeasuring = !isMeasuring; // Toggle the measurement mode
        this.ariaLabel = isMeasuring ? "Stop drawing lines" : "Start drawing lines"
        this.innerHTML = isMeasuring ? '<i><img src="img/btn/icon-close-purple.svg" alt=""></i>Avsluta längdmätning' : '<i><img src="img/btn/icon-draw.svg" alt=""></i>Mät längd'; // Update button text
    

        // Ensure measuring area is turned off when starting line measurement
        if (isMeasuring) {
            isMeasuringArea = false;
            document.getElementById('measureAreaButton').innerHTML = '<i><img src="img/btn/icon-draw.svg" alt=""></i>Mät yta';
            heightmeasureOFF()
        }
        toggleInfoBoxClickActivated(isMeasuring, isMeasuringArea, isMeasuringHeight)
    });

    document.getElementById('measureAreaButton').addEventListener('click', function() {
    isMeasuringArea = !isMeasuringArea; // Toggle the area measurement mode
    this.ariaLabel = isMeasuringArea ? "Stop drawing lines" : "Start drawing lines"
    this.innerHTML = isMeasuringArea ? '<i><img src="img/btn/icon-close-purple.svg" alt=""></i>Avsluta ytmätning' : '<i><img src="img/btn/icon-draw.svg" alt=""></i>Mät yta'; // Update button text
    
    // Ensure measuring line is turned off when starting area measurement
    if (isMeasuringArea) {
        isMeasuring = false;
        document.getElementById('measureButton').innerHTML = '<i><img src="img/btn/icon-draw.svg" alt=""></i>Mät längd';
        heightmeasureOFF()
    }
    toggleInfoBoxClickActivated(isMeasuring, isMeasuringArea, isMeasuringHeight)

});

    document.getElementById('clearButton').addEventListener('click', function() {
    clearAllMeasures();
    clearHeightMeasurements()
});
document.getElementById('measureHeightButton').addEventListener('click', function () {
    if (counter === 0) {
        heightmeasureON();
    }
    else {
        heightmeasureOFF();
    }
    toggleInfoBoxClickActivated(isMeasuring, isMeasuringArea, isMeasuringHeight)
});
}

let counter = 0;
function heightmeasureON() {
    document.getElementById('measureHeightButton').innerHTML = '<i><img src="img/btn/icon-close-purple.svg" alt=""></i>Avsluta höjdmätning';
    document.getElementById('measureAreaButton').innerHTML = '<i><img src="img/btn/icon-draw.svg" alt=""></i>Mät yta';
    document.getElementById('measureButton').innerHTML = '<i><img src="img/btn/icon-draw.svg" alt=""></i>Mät längd';
    isMeasuring = false;
    isMeasuringArea = false;
    isMeasuringHeight = true;

    measureHeight();
    counter++;
}

function heightmeasureOFF() {
    isMeasuringHeight = false;
    handlermeasutreheight.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
    document.getElementById('measureHeightButton').innerHTML = '<i><img src="img/btn/icon-draw.svg" alt=""></i>Mät höjd';
    if (counter >= 1) {
        counter--;
    };    
}

function clearHeightMeasurements() {
    heightpoints.removeAll();
    heightpolylines.removeAll();
    viewer.entities.remove(distanceLabel);
    viewer.entities.remove(horizontalLabel);
    viewer.entities.remove(verticalLabel);
}

function addPoint(position, cumulativeLength) {
    var pointEntity = viewer.entities.add({
        position: position,
        point: {
            outlineWidth: 2,
            outlineColor: CESIUM_COLORS.KOMMUN.BLACK,
            pixelSize: 8,
            color: CESIUM_COLORS.KOMMUN.LIGHTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
    });
    allPoints.push(pointEntity);

    var labelEntity = viewer.entities.add({
        position: position,
        label: {
            text: cumulativeLength.toFixed(2) + ' m',
            font: '20pt Barlow',
            style: Cesium.LabelStyle.BOTTOM,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -15),
            fillColor: CESIUM_COLORS.KOMMUN.WHITE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            showBackground: true
        }
    });
    allLabels.push(labelEntity);
}

function createPoint(worldPosition) {
    const point = {
        position: worldPosition,
        point: {
            pixelSize: 6,
            color: CESIUM_COLORS.KOMMUN.MAIN,
            outlineColor: CESIUM_COLORS.KOMMUN.BLACK,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
    }
    const addedPoint = viewer.entities.add(point)
    activeAreaPoints.push(addedPoint)
    return addedPoint;
}

function removeAllActiveAreaPoints() {
    activeAreaPoints.forEach(point => viewer.entities.remove(point))
    activeAreaPoints = []
}

function drawLine(positions) {
    if (positions.length >= 2) {
        if (currentPolyline) {
            viewer.entities.remove(currentPolyline);
        }
        currentPolyline = viewer.entities.add({
            polyline: {
                positions: positions,
                clampToGround: true,
                width: 3,
                material: CESIUM_COLORS.KOMMUN.BLACK,
                disableDepthTestDistance: Number.POSITIVE_INFINITY

            }
        });
    }
}

function drawArea(positions) {
    if (positions.length >= 3) {
        if (currentAreaPolygon) {
            viewer.entities.remove(currentAreaPolygon);
        }
        currentAreaPolygon = viewer.entities.add({
            polygon: {
                hierarchy: new Cesium.PolygonHierarchy(positions),
                material: new Cesium.ColorMaterialProperty(CESIUM_COLORS.KOMMUN.SUCCESS.withAlpha(0.5)),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                showBackground: true
            }
        });
    }
}

function updateDynamicLabel(position, cumulativeLength) {
    if (currentDynamicPoint) {
        viewer.entities.remove(currentDynamicPoint.label);
    }
    currentDynamicPoint = viewer.entities.add({
        position: position,
        label: {
            text: cumulativeLength.toFixed(2) + ' meter',
            font: '20pt Barlow',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 0,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -15),
            fillColor: CESIUM_COLORS.KOMMUN.WHITE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            showBackground: true,

        }
    });
}

function updateAreaLabel(position, area) {
    if (areaLabelEntity) {
        viewer.entities.remove(areaLabelEntity);
    }
    areaLabelEntity = viewer.entities.add({
        position: position,
        label: {
            text: area.toFixed(2) + ' m²',
            font: '20pt Barlow',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 0,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(...pixelOffsetMove),
            fillColor: CESIUM_COLORS.KOMMUN.WHITE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            showBackground: true
        }
    });
    label.pixelOffset = 
    allLabels.push(areaLabelEntity);
}

function finishLine() {
    if (currentPositions.length >= 2) {
        var length = calculateDrapedLineLength(currentPositions);
        allLines.push(currentPolyline);
        resetDrawingState();
        isMeasuring = !isMeasuring
    }
}

function finishArea() {
    if (currentPositions.length >= 3) {
        var area = calculatePolygonArea(currentPositions);
        currentAreaPolygon.polygon.material = new Cesium.ColorMaterialProperty(CESIUM_COLORS.KOMMUN.LIGHTER.withAlpha(0.6))
        allAreas.push(currentAreaPolygon);
        resetDrawingState();
        isMeasuringArea = !isMeasuringArea
        removeAllActiveAreaPoints()
    }
}

function resetDrawingState() {
    currentPositions = [];
    currentPolyline = null;
    currentDynamicPoint = null;
    currentAreaPolygon = null;
    areaLabelEntity = null; // Remove the dynamic area label
    isFirstPointPlaced = false;
    isMeasuring = false;
    isMeasuringArea = false;
}
export function toggleAllMeasures (){
    isMeasuring = false;
    isMeasuringArea = false;
    document.getElementById('measureAreaButton').textContent = 'Mät yta';
    document.getElementById('measureButton').textContent = 'Mät längd';

}

function calculateDrapedLineLength(positions) {
    var geodesic = new Cesium.EllipsoidGeodesic();
    let totalDistance = 0;
    for (let i = 0; i < positions.length - 1; i++) {
        var startCartographic = Cesium.Cartographic.fromCartesian(positions[i]);
        var endCartographic = Cesium.Cartographic.fromCartesian(positions[i + 1]);
        geodesic.setEndPoints(startCartographic, endCartographic);
        var segmentLength = geodesic.surfaceDistance;
        totalDistance += segmentLength;
    }
    return totalDistance;
}

function calculatePolygonArea(positions) {
    // Convert Cesium.Cartesian3 positions to GeoJSON coordinates
    var coordinates = positions.map(position => {
        var cartographic = Cesium.Cartographic.fromCartesian(position);
        return [Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)];
    });
    
    // Close the polygon if not already closed
    if (coordinates[0] !== coordinates[coordinates.length - 1]) {
        coordinates.push(coordinates[0]);
    }

    // Create a GeoJSON polygon
    var polygon = turf.polygon([coordinates]);

    // Calculate and return the area using Turf.js
    return turf.area(polygon);
}

function clearAllMeasures() {
    // Remove all lines
    allLines.forEach(line => {
        if (line) {
            viewer.entities.remove(line);
        }
    });
    allLines = [];

    // Remove all points
    allPoints.forEach(point => {
        if (point) {
            viewer.entities.remove(point);
        }
    });
    allPoints = [];

    // Remove all labels
    allLabels.forEach(label => {
        if (label) {
            viewer.entities.remove(label);
        }
    });
    allLabels = [];

    // Remove all areas
    allAreas.forEach(area => {
        if (area) {
            viewer.entities.remove(area);
        }
    });
    allAreas = [];

}







// HEIGHTMEASUREMENT 


var heightpoints = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
var heightpoint1, heightpoint2;
var heightpoint1GeoPosition, heightpoint2GeoPosition;
var heightpolylines = viewer.scene.primitives.add(new Cesium.PolylineCollection());
var heightpolyline1, heightpolyline2, heightpolyline3;
var distanceLabel, verticalLabel, horizontalLabel;
var LINEPOINTCOLOR = CESIUM_COLORS.KOMMUN.MAIN; // FÄRG PÅ LINJER/PUNKTER
var DASHLINEPOINTCOLOR = CESIUM_COLORS.KOMMUN.LIGHTER
var LINEPOINTWIDTH = 2;
var ellipsoid = Cesium.Ellipsoid.WGS84;
var geodesic = new Cesium.EllipsoidGeodesic();




function addDistanceLabel(heightpoint1, heightpoint2, height) {
    heightpoint1.cartographic = ellipsoid.cartesianToCartographic(heightpoint1.position);
    heightpoint2.cartographic = ellipsoid.cartesianToCartographic(heightpoint2.position);
    heightpoint1.longitude = parseFloat(Cesium.Math.toDegrees(heightpoint1.position.x));
    heightpoint1.latitude = parseFloat(Cesium.Math.toDegrees(heightpoint1.position.y));
    heightpoint2.longitude = parseFloat(Cesium.Math.toDegrees(heightpoint2.position.x));
    heightpoint2.latitude = parseFloat(Cesium.Math.toDegrees(heightpoint2.position.y));


    const horizontalDistance = getHorizontalDistanceString(heightpoint1, heightpoint2);
    label.text = horizontalDistance.join('');
    label.font = '14pt Barlow',
    label.pixelOffset = new Cesium.Cartesian2(...pixelOffsetRegular)

    if (Number(horizontalDistance[0])) {
        horizontalLabel = viewer.entities.add({
            position: getMidheightpoint(heightpoint1, heightpoint2, heightpoint1GeoPosition.height),
            label: label
        });
    }
    const distance = getDistanceString(heightpoint1, heightpoint2);
    label.text = distance.join('')
    label.pixelOffset = new Cesium.Cartesian2(...pixelOffsetMove)
    if (horizontalDistance.join('') !== distance.join('')) {
        distanceLabel = viewer.entities.add({
        position: getMidheightpoint(heightpoint1, heightpoint2, height),
        label: label
        });

    }
    const verticalDistance = getVerticalDistanceString()
    label.text = verticalDistance.join('');
    label.font = '20pt Barlow',
    label.pixelOffset = new Cesium.Cartesian2(50, 0)

    verticalLabel = viewer.entities.add({
        position: getMidheightpoint(heightpoint2, heightpoint2, height),
        label: label
    });
};

function getHorizontalDistanceString(heightpoint1, heightpoint2) {
    geodesic.setEndPoints(heightpoint1.cartographic, heightpoint2.cartographic);
    var meters = geodesic.surfaceDistance.toFixed(2);
    if (meters >= 1000) {
        return [(meters / 1000).toFixed(1), ' км'];
    }
    return [meters, ' м'];
};

function getVerticalDistanceString() {
    var heights = [heightpoint1GeoPosition.height, heightpoint2GeoPosition.height];
    var meters = Math.max.apply(Math, heights) - Math.min.apply(Math, heights);
    if (meters >= 1000) {
        return [(meters / 1000).toFixed(1), ' км'];
    }
    return [meters.toFixed(2), ' м'];
};

function getDistanceString(heightpoint1, heightpoint2) {
    geodesic.setEndPoints(heightpoint1.cartographic, heightpoint2.cartographic);
    var horizontalMeters = geodesic.surfaceDistance.toFixed(2);
    var heights = [heightpoint1GeoPosition.height, heightpoint2GeoPosition.height];
    var verticalMeters = Math.max.apply(Math, heights) - Math.min.apply(Math, heights);
    var meters = Math.pow((Math.pow(horizontalMeters, 2) + Math.pow(verticalMeters, 2)), 0.5);
    if (meters >= 1000) {
        return [(meters / 1000).toFixed(1), ' км'];
    }
    return [meters.toFixed(2), ' м'];
};

function getMidheightpoint(heightpoint1, heightpoint2, height) {
    var scratch = new Cesium.Cartographic();
    geodesic.setEndPoints(heightpoint1.cartographic, heightpoint2.cartographic);
    var midheightpointCartographic = geodesic.interpolateUsingFraction(0.5, scratch);
    return Cesium.Cartesian3.fromRadians(midheightpointCartographic.longitude, midheightpointCartographic.latitude, height);
};


//-------------------------- Mätning mellan 2 punkter

// Mouse over the globe to see the cartographic position
var handlermeasutreheight = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

function measureHeight() {
    handlermeasutreheight.setInputAction(function (click) {
        if (viewer.scene.mode !== Cesium.SceneMode.MORPHING) {
            if (viewer.scene.pickPositionSupported) {
                var cartesian = viewer.scene.pickPosition(click.position);
                if (Cesium.defined(cartesian)) {
                    if (heightpoints.length === 2) {
                        heightpoints.removeAll();
                        heightpolylines.removeAll();
                        viewer.entities.remove(distanceLabel);
                        viewer.entities.remove(horizontalLabel);
                        viewer.entities.remove(verticalLabel);
                    }
                    //add first heightpoint VILL DU HA ETT "RENSKLICK" MELLAN MÄTNINGARNA LÄGGER DU IN "ELSE" FÖRE NEDANSTÅENDE "IF" SATS
                    if (heightpoints.length === 0) {
                        const hpInput = {
                            position: new Cesium.Cartesian3(cartesian.x, cartesian.y, cartesian.z),
                            color: CESIUM_COLORS.KOMMUN.MAIN,
                            disableDepthTestDistance: Number.POSITIVE_INFINITY,
                            outlineColor: CESIUM_COLORS.KOMMUN.LIGHTER,
                            outlineWidth: 2,
                        }
                        heightpoint1 = heightpoints.add(hpInput);

                    }
                    //add second heightpoint and lines
                    else if (heightpoints.length === 1) {
                        const hpInput = {
                            position: new Cesium.Cartesian3(cartesian.x, cartesian.y, cartesian.z),
                            color: CESIUM_COLORS.KOMMUN.MAIN,
                            disableDepthTestDistance: Number.POSITIVE_INFINITY,
                            outlineColor: CESIUM_COLORS.KOMMUN.LIGHTER,
                            outlineWidth: 2,
                        }
                        heightpoint2 = heightpoints.add(hpInput);
                        heightpoint1GeoPosition = Cesium.Cartographic.fromCartesian(heightpoint1.position);
                        heightpoint2GeoPosition = Cesium.Cartographic.fromCartesian(heightpoint2.position);
                        //heightpoint3GeoPosition = Cesium.Cartographic.fromCartesian(new Cesium.Cartesian3(heightpoint2.position.x, heightpoint2.position.y, heightpoint1.position.z));


                        var pl1Positions = [
                            new Cesium.Cartesian3.fromRadians(heightpoint1GeoPosition.longitude, heightpoint1GeoPosition.latitude, heightpoint1GeoPosition.height),
                            new Cesium.Cartesian3.fromRadians(heightpoint2GeoPosition.longitude, heightpoint2GeoPosition.latitude, heightpoint2GeoPosition.height)
                        ];
                        var pl2Positions = [
                            new Cesium.Cartesian3.fromRadians(heightpoint2GeoPosition.longitude, heightpoint2GeoPosition.latitude, heightpoint2GeoPosition.height),
                            new Cesium.Cartesian3.fromRadians(heightpoint2GeoPosition.longitude, heightpoint2GeoPosition.latitude, heightpoint1GeoPosition.height)
                        ];
                        var pl3Positions = [
                            new Cesium.Cartesian3.fromRadians(heightpoint1GeoPosition.longitude, heightpoint1GeoPosition.latitude, heightpoint1GeoPosition.height),
                            new Cesium.Cartesian3.fromRadians(heightpoint2GeoPosition.longitude, heightpoint2GeoPosition.latitude, heightpoint1GeoPosition.height)
                        ];

                        heightpolyline1 = heightpolylines.add({
                            show: true,
                            positions: pl1Positions,
                           width: LINEPOINTWIDTH,
                            material: new Cesium.Material({
                                fabric: {
                                    type: 'PolylineDash',
                                    uniforms: {
                                        color: DASHLINEPOINTCOLOR
                                    },
                                }
                            }),
                            disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        });
                        heightpolyline2 = heightpolylines.add({
                            show: true,
                            positions: pl2Positions,
                           width: LINEPOINTWIDTH,
                            material: new Cesium.Material({
                                fabric: {
                                    type: 'Color',
                                    uniforms: {
                                        color: LINEPOINTCOLOR,
                                    }
                                },
                            }),
                            disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        });
                        heightpolyline3 = heightpolylines.add({
                            show: true,
                            positions: pl3Positions,
                           width: LINEPOINTWIDTH,
                            material: new Cesium.Material({
                                fabric: {
                                    type: 'PolylineDash',
                                    uniforms: {
                                        color: DASHLINEPOINTCOLOR,
                                    }
                                },
                            }),
                            disableDepthTestDistance: Number.POSITIVE_INFINITY,

                        });
                        var heightlabelZ;
                        if (heightpoint2GeoPosition.height >= heightpoint1GeoPosition.height) {
                            heightlabelZ = heightpoint1GeoPosition.height + (heightpoint2GeoPosition.height - heightpoint1GeoPosition.height) / 2.0;
                        } else {
                            heightlabelZ = heightpoint2GeoPosition.height + (heightpoint1GeoPosition.height - heightpoint2GeoPosition.height) / 2.0;
                        };


                        addDistanceLabel(heightpoint1, heightpoint2, heightlabelZ);

                    }
                }
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

}




// END