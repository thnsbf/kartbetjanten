import sensorShadow from "./sensor-shadow/sensor-shadow.js";
import { getDarkerCesiumColor, fromDecimalsToBytes } from "./utils.js";
import { flyToLoc } from "./zoom-functions.js";




// Set extent

var extent = Cesium.Rectangle.fromDegrees(11.10770320892334, 69.05996720139402, 24.155517578125, 55.33778335768852);
    Cesium.Camera.DEFAULT_VIEW_RECTANGLE = extent;
    Cesium.Camera.DEFAULT_VIEW_FACTOR = 0;

    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1NTdkOTBlZi1hODJlLTQ5ODktOTdhZC01NDMxNDU0ZTg1MTMiLCJpZCI6MTE0MzEyLCJpYXQiOjE2NjgwMDE4OTl9.XnYVR35D4XVls91_O2vo72ovO4yOEuk71I2l2Jv-zQs';


// Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.

function initializeViewer() {
  
}
const markmodellForaldrad = 1526830

export const terrain = new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromIonAssetId(markmodellForaldrad))

const viewer = new Cesium.Viewer('cesiumContainer', {
    terrain: terrain,
    timeline: false,
    animation: false, 
    projectionPicker: false,
    sceneModePicker: false,
    vrButton: false,
    fullscreenButton: false,
    homeButton: false,
    selectionIndicator : false,
    infoBox : false,    
    shadows: false,
    shouldAnimate: false,
    navigationHelpButton: false,
    baseLayerPicker: false,
    imageryProvider: false,
    geocoder: Cesium.IonGeocodeProviderType.GOOGLE
  });  

  viewer.scene.globe.baseColor = Cesium.Color.WHITE;
  viewer.scene.globe.depthTestAgainstTerrain = true;

 /*  var shadowMap = viewer.shadowMap;
  shadowMap.maximumDistance = 3000;
  shadowMap.size = 4096;
  shadowMap.darkness = 0.7; */


  export function toggleInfoBoxClickActivated(isMeasuring, isMeasuringArea, isMeasuringHeight) {
    if (isMeasuring || isMeasuringArea || isMeasuringHeight) {
      viewer.infoBox.container.style.display = 'none'
    } else {
      viewer.infoBox.container.style.display = 'unset'
    }
  }
  
  // Turn off all basemaps to prevent token usage
viewer.scene.imageryLayers.removeAll();
//Gratis OSM MAP
/*   const provider = new Cesium.WebMapServiceImageryProvider({
    url : ' https://ows.terrestris.de/osm/service?',
    layers : 'OSM-WMS'
});
const imageryLayer = new Cesium.ImageryLayer(provider);
viewer.imageryLayers.add(imageryLayer); */
// Functions to set different terrains




const handlerBuildingHover = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

const popUpElem = document.createElement('div')
popUpElem.id = "building-hover-popup"
popUpElem.style = `
  display: none; 
  position: absolute; 
  background: var(--c-background-popup-hover); 
  padding: 5px; 
  border: 1px solid #ccc; 
  font-size: 12px;
  `
document.body.appendChild(popUpElem)


let lastHoveredSurfaceColor = null
let lastHoveredObject = null


handlerBuildingHover.setInputAction(function (movement) {
  const pickedObject = viewer.scene.pick(movement.endPosition);
  const tooltip = document.getElementById("building-hover-popup");

  if (
    Cesium.defined(pickedObject) &&
    Cesium.defined(pickedObject.id) &&
    pickedObject.id.polygon &&
    pickedObject.id.properties &&
    pickedObject.id.properties.terrainHeight
  ) {
    const entity = pickedObject.id;
    const terrainHeight = typeof entity.properties.terrainHeight === "object" ? entity.properties.terrainHeight._value : entity.properties.terrainHeight;
    const extrudedHeight = entity.polygon.extrudedHeight.getValue(Cesium.JulianDate.now());
    const roofMSL = terrainHeight + extrudedHeight;

    tooltip.style.left = movement.endPosition.x + 10 + "px";
    tooltip.style.top = movement.endPosition.y + 10 + "px";
    tooltip.innerHTML = `
      Building projected roof height above MSL: ${roofMSL.toFixed(2)} m <br>
      Terrain lowest point height above MSL: ${terrainHeight.toFixed(2)} m <br>
      Building extruded height above lowest point: ${extrudedHeight.toFixed(2)} m
    `;
    tooltip.style.display = "block";
  } else if (
    Cesium.defined(pickedObject) &&
    pickedObject.id?.hasOwnProperty("AREAL")
  ) {
    if (lastHoveredObject && lastHoveredObject !== pickedObject) lastHoveredObject.id.polygon.material = lastHoveredObject.id.color
    if (pickedObject.id.surfaceName !== "Hårdgjorda ytor") {
      lastHoveredObject = pickedObject
      const darkerColor = pickedObject.id.hoverColor
      pickedObject.id.polygon.material = darkerColor
    }
    
    tooltip.style.left = movement.endPosition.x + 10 + "px";
    tooltip.style.top = movement.endPosition.y + 10 + "px";
    tooltip.innerHTML = `
      ${pickedObject.id.surfaceName}: ${Math.round(pickedObject.id.AREAL)} m²
    `;
    tooltip.style.display = "block";
  } else {
    tooltip.style.display = "none";
    
    // Reset color from hovering surface
    if (lastHoveredObject) lastHoveredObject.id.polygon.material = lastHoveredObject.id.color

  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);




function setTerrain1() {
  viewer.scene.setTerrain(
    new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromIonAssetId(1))
  );
}

function setTerrain2() {
  viewer.scene.terrainProvider = new Cesium.EllipsoidTerrainProvider(Cesium.Ellipsoid.WGS84);
}

function setTerrain3(){
  viewer.scene.setTerrain(
    new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl("/terrain/"))
  );
}
// Event listeners for button clicks

/* document.getElementById('terrain1').addEventListener('click', setTerrain1);
document.getElementById('terrain2').addEventListener('click', setTerrain2);
document.getElementById('terrain3').addEventListener('click', setTerrain3); */



// Add Cesium OSM Buildings, a global 3D buildings layer.

export {viewer}; 

// NavigationMixin
viewer.extend(Cesium.viewerCesiumNavigationMixin, {});

// Drag and drop
viewer.extend(Cesium.viewerDragDropMixin, {
  clearOnDrop: false,
  flyToOnDrop: true
  
});
viewer.dropError.addEventListener(function (viewerArg, source, error) {
window.alert('Error processing ' + source + ':' + error);
});
// Styling drag and drop
viewer.dataSources.dataSourceAdded.addEventListener(function (collection, dataSource) {
  var entities = dataSource.entities.values;
  for (var i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.billboard) {
        entity.billboard.translucencyByDistance = new Cesium.NearFarScalar(2000, 1, 20000, 0.0);
        entity.billboard.scaleByDistance = new Cesium.NearFarScalar(500, 2, 20000, 0.0);
        entity.billboard.color = Cesium.Color.RED;
    }
    if (entity.polyline) {
        entity.polyline.material = Cesium.Color.BLACK;
        entity.polyline.width = 3;
        entity.polyline.clampToGround = false;
    }
    if (entity.polygon) {
        entity.polygon.material = Cesium.Color.RED;
        entity.polygon.outline = true;
        entity.polygon.outlineColor = Cesium.Color.BLACK;
        entity.polygon.outlineWidth = 4;
        entity.polygon.clampToGround = false;
        entity.polygon.shadows = Cesium.ShadowMode.ENABLED;
    }
     

  }
});

  // ----------------------------- SENSOR-SHADOW TEST --------------------------------- //

  

  

  // ----------------------------- SENSOR-SHADOW TEST -----  END  --------------------------------- //

