import { viewer } from "./viewer.js";
import { CESIUM_COLORS } from "./colors/colors.js";
/* Searchbar */
///////////////
const searchInput = document.getElementById("address-search");
const addressDropdown = document.getElementById("addressDropdown");
const elemCheckboxSearch = document.getElementById("checkbox-search");
const elemCloseInputBoxBtn = document.getElementById("close-input-box-btn");

elemCloseInputBoxBtn.addEventListener("click", () => {
  elemCheckboxSearch.checked = false
})

let tempPointEntity = undefined; // To store the temporary point entity

// Function to populate the address dropdown with suggestions
function populateAddressDropdown(suggestions) {
  addressDropdown.innerHTML = "";
  suggestions.forEach(function (suggestion) {
    let addressItem = document.createElement("li");
    addressItem.classList.add("addressItem");
    //suggestion.attribut 
    addressItem.textContent = suggestion.properties.td_adress + ", " + suggestion.properties.td_kommund; // Include "td_kommund"
    addressItem.addEventListener("click", function () {
      flyToCoordinates(
        suggestion.geometry.coordinates[1],
        suggestion.geometry.coordinates[0],
        suggestion.properties.td_adress,
        suggestion.properties.td_kommund // Pass "td_kommund"
      );
    
       // Clear the text input
      // searchInput.value = '';
    });
    addressDropdown.appendChild(addressItem);
  });
  addressDropdown.style.display = "block";
}

// Function to fly to the specified coordinates
function flyToCoordinates(lat, lon, td_adress, td_kommund) {
  // Sample the height at the specified location
  var heightPromise = Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [Cesium.Cartographic.fromDegrees(lon, lat)]);
  var height = 0;

  heightPromise.then(function (samples) {
    height = samples[0].height;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height + 200), // Fly 200 meters above the terrain
      duration: 2
    });

    // Remove previous temporary point
    if (tempPointEntity) {
      viewer.entities.remove(tempPointEntity);
    }

    // Create the temporary point entity
    tempPointEntity = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, height + 0.1),
      point: {
        pixelSize: 12,
        color: CESIUM_COLORS.KOMMUN.MAIN,
        outlineColor: CESIUM_COLORS.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text:  td_adress + ", " + td_kommund, // Include "td_kommund"
        font: "20px Barlow",
        showBackground: true,
        backgroundColor: CESIUM_COLORS.KOMMUN.BLACK,
        fillColor: CESIUM_COLORS.WHITE,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, 16),
        backgroundPadding: new Cesium.Cartesian2(10, 10),
        outlineColor: CESIUM_COLORS.WHITE,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
    });

    // Remove the temporary point after 10 seconds
    setTimeout(function () {
      viewer.entities.remove(tempPointEntity);
    }, 100000);

    addressDropdown.style.display = "none";
  });
}

export function initializeAddressSearch() {
  // Fetch addresses from addresses.json
fetch("json/adresser.json")
.then(response => response.json())
.then(addresses => {
  searchInput.addEventListener("input", function () {
    var inputValue = searchInput.value.toLowerCase();
    var suggestions = addresses.features.filter(function (address) {
      return address.properties.td_adress && address.properties.td_adress.toLowerCase().includes(inputValue); // Use "td_adress" with additional check
    });
    if (inputValue === "") {
      addressDropdown.style.display = "none";
    } else {
      populateAddressDropdown(suggestions);
    }
  });
});

// Close the address dropdown when clicking outside
document.addEventListener("click", function (event) {
if (!addressDropdown.contains(event.target) && event.target !== searchInput) {
  addressDropdown.style.display = "none";
}
});
}


