import { viewer } from "./viewer.js";


let lastActiveBaselayerButton = null;
let activeImageryLayer = null; // Declare activeImageryLayer variable
let baselayers = []

// Function to handle button click event
export function handleBaselayerButtonClick(button, layerId) {
  // Remove active class from previous last active button
  if (lastActiveBaselayerButton) {
    lastActiveBaselayerButton.classList.remove('active');
  }
  // Add active class to the clicked button
  button.classList.add('active');
  // Update last active button
  lastActiveBaselayerButton = button;
  activateBaselayer(layerId);
}

// Function to activate baselayer
async function activateBaselayer(layerId) {
  if (activeImageryLayer) {
    viewer.imageryLayers.remove(activeImageryLayer); // Remove the active imagery layer if it exists
  }

  const layer = baselayers.find(lay => lay.id === layerId)
  if (!layer) console.error("Layer not found: ", layerId)
  let provider = layer.provider
  if (layerId === 'open-street-map') {
    try {
      provider = await provider;
    } catch (error) {
      console.error("Failed to load Cesium Ion Imagery Provider:", error);
      return;
    }
  }
  // Add the base layer imagery as the bottom layer
  activeImageryLayer = viewer.imageryLayers.addImageryProvider(provider, 0); // 0 specifies the index to add the imagery layer
}


export function initializeBaselayers() {


baselayers.push({
  provider: new Cesium.WebMapServiceImageryProvider({
    url:
      "https://kartportalen.trollhattan.se/wms?servicename=wms_orto&",
    layers: "theme-ortofoto_2022",
    parameters: {
      transparent: true,
      format: "image/png",
    }
  }),
  id: "theme-ortofoto_2022",
  showOsmBuildings: false
});

baselayers.push({
  provider: new Cesium.WebMapServiceImageryProvider({
    url:
      "https://kartportalen.trollhattan.se/wms?servicename=wms_publicering&",
    layers: "theme-baskarta-cesium",
    parameters: {
      transparent: true,
      format: "image/png",
    },
  }),
  id: "theme-baskarta-cesium",
  showOsmBuildings: true
});

baselayers.push({
  provider: new Cesium.WebMapServiceImageryProvider({
    url: 
      "https://kartportalen.trollhattan.se/wms?servicename=wms_publicering&",
    layers: "theme-baskarta-dimmad-cesium",
    parameters: {
      transparent: true,
      format: "image/png",
    },
  }),
  id: "theme-baskarta-dimmad-cesium",
  showOsmBuildings: true
});

baselayers.push({
  provider: new Cesium.WebMapServiceImageryProvider(
    {
      url:
        "https://kartportalen.trollhattan.se/wms?servicename=wms_dp_cesium",
      layers: "theme-dp_cesium",
      parameters: {
        transparent: true,
        format: "image/png",
      },
    }
  ),
  id: "theme-dp_cesium",
  showOsmBuildings: true
})

baselayers.push({
  provider: Cesium.IonImageryProvider.fromAssetId(4),
  id: "open-street-map",
  showOsmBuildings: false
});



// Get all the buttons by their IDs
const buttons = [
  { id: 'Baselayer-button1', layerId: 'theme-baskarta-dimmad-cesium' },
  { id: 'Baselayer-button2', layerId: 'theme-baskarta-cesium' },
  { id: 'Baselayer-button3', layerId: 'theme-ortofoto_2022' },
  { id: 'Baselayer-button4', layerId: 'open-street-map' },
  { id: 'Baselayer-button5', layerId: 'theme-dp_cesium' }
];

// Iterate over the buttons and attach event listeners
buttons.forEach(({ id, layerId }, index) => {
  const button = document.getElementById(id);
  if (button) {
    button.addEventListener('change', function(event) {
      //event.preventDefault(); // Prevent default anchor behavior
      handleBaselayerButtonClick(button, layerId);
    });

    // Set the first button as active at startup
    if (index === 0) {
      button.classList.add('active');
      lastActiveBaselayerButton = button;
      activateBaselayer(layerId); // Activate the first layer by default
    }
  }
});


}