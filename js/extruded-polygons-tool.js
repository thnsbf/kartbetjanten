
import { viewer, toggleInfoBoxClickActivated } from "./viewer.js";
import { updateAriaVisibility } from "./aria.js";
import { CESIUM_COLORS } from "./colors/colors.js";
let activeShapePoints = [];
let activeShape;
let activePoints = []
let floatingPoint;
let drawnPolygons = []; // To store references to drawn polygons
let isDrawing = false;  // Track the drawing mode state
let drawingHandler;     // Store the drawing handler
export var slider = document.getElementById('extrusionHeight');
export var heightValue = document.getElementById('heightValue');

function initializeDrawing() {
    if (isDrawing) {
        return; // Don't initialize if already in drawing mode
    }

    isDrawing = true; // Set the drawing mode to true
    drawingHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

    drawingHandler.setInputAction((event) => {

        try {
            console.log(activeShapePoints)
            const earthPosition = safePickPosition(event.position);
            if (!Cesium.defined(earthPosition)) return;
            if (activeShapePoints.length === 0) {
                floatingPoint = createPoint(earthPosition);
                activeShapePoints.push(earthPosition);
                const dynamicPositions = new Cesium.CallbackProperty(() => {
                    return new Cesium.PolygonHierarchy(activeShapePoints);
                }, false);
                activeShape = drawShape(dynamicPositions);
                activeShape.dynamicPositions = dynamicPositions;
            }
            if (!positionIsTwiceInARow([activeShapePoints[-1], earthPosition]))
                activeShapePoints.push(earthPosition);
                createPoint(earthPosition);
        } catch (error) {
            console.log(error)
        }
        
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    drawingHandler.setInputAction((event) => {
        if (!Cesium.defined(floatingPoint)) {
            return
        }
        
        const newPosition = safePickPosition(event.endPosition);
        if (Cesium.defined(newPosition)) {
            floatingPoint.position.setValue(newPosition);
            activeShapePoints[activeShapePoints.length - 1] = newPosition;
        }
    
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Handle double left-click to finish the polygon
    drawingHandler.setInputAction(() => {
        try {
            activeShapePoints.pop()
            const filteredActiveShapePoints = removeDuplicatePositions(activeShapePoints.filter(cur => cur))

            if (positionIsTwiceInARow(filteredActiveShapePoints)) {
                filteredActiveShapePoints.pop()
            }
            if (filteredActiveShapePoints < 3) return
            
                const polygonEntity = extrudePolygon(filteredActiveShapePoints);
                if (Cesium.defined(floatingPoint)) viewer.entities.remove(floatingPoint);
                if (Cesium.defined(activeShape)) {
                    viewer.entities.remove(activeShape)
                    if (activeShape.dynamicPositions) activeShape.dynamicPositions = null;
                };
                drawnPolygons.push(polygonEntity);
                startNewPolygon();  // Start drawing a new polygon immediately
            
        } catch (error) {
            console.log(error)
        }
        
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}

function startNewPolygon() {
    // Reset variables for the next polygon
    restartDrawingSession()
}



function restartDrawingSession() {
    // Fully destroy the event handler and reinitialize it
    if (drawingHandler) {
        drawingHandler.destroy();
        drawingHandler = null;
    }

    activeShapePoints = [];
    activeShape = undefined;
    floatingPoint = undefined;
    isDrawing = false
    viewer.scene.requestRender();
    setTimeout(() => {
        initializeDrawing(); // Ensure a fresh handler is created
    }, 10); // Small delay to prevent race conditions
}

function createPoint(worldPosition) {
    const point = {
        position: worldPosition,
        point: {
            pixelSize: 4,
            color: CESIUM_COLORS.KOMMUN.MAIN,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          },
    }
    const addedPoint = viewer.entities.add(point)
    activePoints.push(addedPoint)
    return addedPoint;
}

function safePickPosition(position) {
    try {
        return viewer.scene.pickPosition(position) || null;
    } catch (error) {
        console.warn("pickPosition() returned undefined.", error);
        return null;
    }
}

function drawShape(positionData) {
    return viewer.entities.add({
        polygon: {
            hierarchy: positionData,
            material: new Cesium.ColorMaterialProperty(CESIUM_COLORS.KOMMUN.SUCCESS.withAlpha(0.7)),
        },
    });
}

function extrudePolygon(positions) {
    try {
        const cartographicPositions = positions.map(position => {
            return Cesium.Cartographic.fromCartesian(position);
        });
    
        const minHeight = Math.min(...cartographicPositions.map(pos => pos.height));
    
        // Get the extrusion height from user input
        const extrusionHeightInput = document.getElementById('extrusionHeight');
        const extrusionHeight = parseFloat(extrusionHeightInput.value) || 0;
    
        if (positions.length < 3) return
        removeAllPoints()
        return viewer.entities.add({
            polygon: {
                hierarchy: positions,
                extrudedHeight: minHeight + extrusionHeight,
                material: CESIUM_COLORS.KOMMUN.LIGHTER.withAlpha(0.7),  // Change color to grey
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                shadows: Cesium.ShadowMode.ENABLED  // Enable shadows
    
            },
        });
    } catch (error) {
        console.log(error)
    }
    
}

// Function to remove all drawn polygons
export function removeAllPolygons() {
    drawnPolygons.forEach(polygon => viewer.entities.remove(polygon));
    drawnPolygons = []; // Clear the reference list
}

export function removeAllPoints() {
    activePoints.forEach(point => viewer.entities.remove(point));
    activePoints = []; // Clear the reference list
}

// Function to toggle the drawing mode
export function toggleDrawing() {
    const startExtrudeDrawingButton = document.getElementById('startExtrudeDrawingButton')

    if (isDrawing) {
        // Stop drawing
        isDrawing = false;
        if (drawingHandler) {
            drawingHandler.destroy();
            drawingHandler = undefined; // Clear the handler reference
        }
        startExtrudeDrawingButton.innerHTML = '<i><img id="draw-polygon-icon" src="img/btn/icon-draw.svg" alt="Start drawing"></i>Börja rita';
        startExtrudeDrawingButton.ariaLabel = "Start drawing"
    } else {
        // Start drawing
        initializeDrawing();
        startExtrudeDrawingButton.innerHTML = '<i><img id="draw-polygon-icon" class="draw-polygon-icon--stop" src="img/btn/icon-close-purple.svg" alt="Stop drawing" aria-label="Stop drawing"></i>Sluta rita';
        startExtrudeDrawingButton.ariaLabel = "Stop drawing"
    
    }
    toggleInfoBoxClickActivated(isDrawing)
}

// Initialize with drawing mode off
// You can start drawing by clicking the "Start Drawing" button

function positionIsTwiceInARow(positions) {
    if (!positions || positions.length < 2) return false
    for (let i = 0; i < positions.length; i++) {
        if (!positions[i]) return false
        const { x, y, z } = positions[i]
        const nextX = positions[i + 1]?.x || null
        const nextY = positions[i + 1]?.y || null
        const nextZ = positions[i + 1]?.z || null

        if (x === nextX && y === nextY && z === nextZ) return true
    }
    return false
}

function removeDuplicatePositions(positions) {
    const newPositions = []
    for (let i = 0; i < positions.length; i++) {
        if (newPositions.every(pos => !areObjectsEqual(pos, positions[i]))) {
            newPositions.push(positions[i])
        }
    }
    return newPositions
}

function areObjectsEqual(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
        return false;
    }

    return keys1.every(key => obj2.hasOwnProperty(key) && obj1[key] === obj2[key]);
}