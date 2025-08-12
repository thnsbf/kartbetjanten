import { CESIUM_COLORS } from "./colors/colors.js";
import { createStatsWindow, createInfoWindow, createColorCategoryWindow } from "./projects.js";
import { viewer, terrain } from "./viewer.js";
import { sampleTerrainHeight, sampleMinimumTerrainHeightUnderPolygon } from "./utils-cesium.js";
import { getDarkerCesiumColor } from "./utils.js";


export async function initializeAsset(curId, asset, projectName) {
  const countFaultyPolylines = []
  if (!viewer.terrainProvider) await viewer.terrainProvider
  const assetType = asset.assetType || "3dtile"
  if (assetType !== "3dtile") {
    switch (assetType) {
      case 'controller': {
        const radioButtonElem = document.getElementById("buildings-button-1")
        radioButtonElem.checked = asset.showDefault
        if (asset.showDefault) {
          setTimeout(() => {
            radioButtonElem.dispatchEvent(new Event('click'))
          }, 4000);

        }
        return { assetType, target: radioButtonElem }
      }
      case 'imagery': {
        const imagery = await Cesium.IonImageryProvider.fromAssetId(curId)
        const tileset = await viewer.imageryLayers.addImageryProvider(imagery)
        return tileset
      }
      case "infoWindow": {
        const infoWindowElem = createInfoWindow(asset, asset.assetGroupId, projectName)
        
        infoWindowElem.dataset.assetType = "infoWindow"
        infoWindowElem.dataset.assetGroupId = asset.assetGroupId

        return { elem: infoWindowElem, assetType: "infoWindow" }
      }
      case 'geojson': {
        const resource = await Cesium.IonResource.fromAssetId(curId);
        const dataSource = await Cesium.GeoJsonDataSource.load(resource);
        const tilesets = []

        dataSource.entities.values.forEach(value => {
          if (value.polyline) {
            const polyline = viewer.entities.add({
              polyline: {
                positions: value.polyline.positions._value,
                width: asset.lineWidth || 2,
                material: Cesium.Color[asset.color],
                clampToGround: true              
              }
  
            })
            tilesets.push(polyline)

          } else if (value.polygon) {
            const positions = value.polygon.hierarchy._value.positions
            const index = asset.ionIds.indexOf(curId)
            const color = asset.colors && asset.colors[index] ? [asset.colors[index]] : asset.color
            const material = CESIUM_COLORS[asset.colorCategory][color]
            const polygon = viewer.entities.add({
                polygon: {
                    hierarchy: positions,
                    material: material ,  
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    classificationType: Cesium.ClassificationType.TERRAIN

                }
              });
            tilesets.push(polygon)
            countFaultyPolylines.push(1)
          }

        })
        const finalObject = {tilesets, assetType: asset.assetType}


        return finalObject
      }
       case 'geojsonDonut': {

        
          /* {
            "assetGroupId": "hults-hojd-vagar",
            "ionIds": [3485096],
            "cutOutIds": [3485098],
            "name" : "Vägar",
            "showDefault" : true,
            "assetType": "geojsonDonut",
            "color": "GREEN"
          } */

            /* {
            "assetGroupId": "hults-hojd-hojdkurva",
            "ionIds": [3472345],
            "name" : "Höjdkurva",
            "showDefault" : false,
            "assetType": "geojson",
            "color": "LIGHTGREY",
            "lineWidth": 1.5
          }, */

        const resource = await Cesium.IonResource.fromAssetId(curId);
        const dataSource = await Cesium.GeoJsonDataSource.load(resource);
        const tilesets = []

        dataSource.entities.values.forEach(async value => {
          if (value.polyline) {
            const polyline = viewer.entities.add({
              polyline: {
                positions: value.polyline.positions._value,
                width: asset.lineWidth || 2,
                material: Cesium.Color[asset.color],
                clampToGround: true,
                show: asset.showDefault
              }
  
            })
            tilesets.push(polyline)

          } else if (value.polygon) {
    const outerRaw = value.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions;
    const outerDegrees = cartesianArrayToDegreesArray(outerRaw);
    const outerPositions = Cesium.Cartesian3.fromDegreesArray(outerDegrees);

    const holes = [];

    for (const cutOutId of asset.cutOutIds) {
        const resourceCutOut = await Cesium.IonResource.fromAssetId(cutOutId);
        const dataSourceCutOut = await Cesium.GeoJsonDataSource.load(resourceCutOut);

        for (const entity of dataSourceCutOut.entities.values) {
            if (entity.polygon && entity.polygon.hierarchy) {
                const rawHole = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now()).positions;
                const holeDegrees = cartesianArrayToDegreesArray(rawHole);
                const holePositions = Cesium.Cartesian3.fromDegreesArray(holeDegrees);
                holes.push(holePositions);
            }
        }
    }

    // Now use the cleaned-up positions
    const polygon = viewer.entities.add({
        polygon: {
            hierarchy: new Cesium.PolygonHierarchy(outerPositions, holes),
            holes: holes,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            classificationType: Cesium.ClassificationType.TERRAIN,
            material: Cesium.Color[asset.color],
            shadows: Cesium.ShadowMode.ENABLED
        }
    });

    tilesets.push(polygon);
}




        })
        return {tilesets, assetType: asset.assetType}
      }
      case "geojsonBuildingExtrusion": {
        const tilesets = []
        const index = asset.ionIds.indexOf(curId)
          const resource = await Cesium.IonResource.fromAssetId(curId);
          const dataSource = await Cesium.GeoJsonDataSource.load(resource);
          const color = Cesium.Color[asset.color]
          dataSource.entities.values.forEach(async value => {
            try {
              if (value.polyline) {
                const polyline = viewer.entities.add({
                  polyline: {
                    positions: value.polyline.positions._value,
                    width: 2,
                    material: color,
                    clampToGround: true
                  }
                })
                tilesets.push(polyline)

              } else if (value.polygon) {
                const positions = value.polygon.hierarchy._value.positions
                const minHeightCartesian = positions.reduce((acc, cur) => {
                  return !acc.z ? cur : cur.z < acc.z ? cur : acc
                }, {x: 0, y: 0, z: 0})
                
                let subtractor = 0
                const hierarchy = Cesium.Property.getValueOrUndefined(value.polygon.hierarchy, Cesium.JulianDate.now());
                 const sampledTerrainHeight = await sampleMinimumTerrainHeightUnderPolygon(viewer, hierarchy, 1)             
/*                 const sampledTerrainHeight = await sampleTerrainHeight(viewer, minHeightCartesian)
 */               

                if (asset.aboveSeaIndex.includes(index)) {
                  subtractor += sampledTerrainHeight
                }  
                const extrusionHeight = parseFloat(asset.height[index]) - subtractor
                if (extrusionHeight < 0.01) throw new Error("Extruded height less than terrain height - no building drawn")
                if (positions.length < 3) throw new Error("Not enough position points to draw a polygon.")
                
                const tileset = viewer.entities.add({
                  polygon: {
                      hierarchy: positions,
                      extrudedHeight: extrusionHeight,
                      material: color,  
                      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                      shadows: Cesium.ShadowMode.ENABLED
                  },
                  properties: {
                    terrainHeight: sampledTerrainHeight,
                    buildingHeight: parseFloat(asset.height[index])
                  }
                });
                tilesets.push(tileset)

              }
            } catch (error) {
              console.log(error)
            }
          })
          let finalObject = {tilesets, assetType: "geojsonBuildingExtrusion" }
          /* if (asset.hasOwnProperty("colors")) {
            const statsWindow = createStatsWindow(asset, asset.assetGroupId, projectName, "height")
            finalObject.statsWindow = statsWindow
          } */
          return finalObject
        
            
      }
      case 'polygonWithImage': {
        const polygon = {
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(
              Cesium.Cartesian3.fromDegreesArray(asset.hierarchy)
            ),
            material: asset.assetSrc,
            classificationType: Cesium.ClassificationType.TERRAIN,
          },
        };
        const tileset = viewer.entities.add(polygon)
        tileset.assetType = "polygonWithImage"
        console.log(tileset)
        return tileset
      }
      case 'multiPolygon': {
        const tilesets = []
        for (const hierarchy of asset.hierarchies) {
          const polygon = {
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(
                Cesium.Cartesian3.fromDegreesArray(hierarchy)
              ),
              material: CESIUM_COLORS[asset.colorCategory][asset.color],
              classificationType: Cesium.ClassificationType.TERRAIN,
            },
          };
          const tileset = await viewer.entities.add(polygon)
          tileset.assetType = "polygon"
          tilesets.push(tileset)
        }
        return {tilesets, assetType: "multiPolygon"}
      }
      case 'multiPolygonGroup': {
        const tilesets = []
        const index = asset.ionIds.indexOf(curId)
        const resource = await Cesium.IonResource.fromAssetId(curId);
        const dataSource = await Cesium.GeoJsonDataSource.load(resource);
       
        const allData = dataSource.entities.values
        const currentData = allData.filter(item => {
          const value = item.properties.NAMN._value
          return value?.toLowerCase() == projectName.toLowerCase()
        })
        const individualPayloads = []
        const totPayload = currentData.reduce((acc, cur) => {
          const value = cur.properties.AREAL._value
          individualPayloads.push(value)
          return acc + value
        }, 0)

        const groundColor = CESIUM_COLORS[asset.colorCategory][asset.colors[index]]
        const darkerColor = getDarkerCesiumColor(groundColor)
        for (let i = 0; i < currentData.length; i++) {
          const positions = currentData[i].polygon.hierarchy._value.positions
          const polygon = {
            polygon: {
              hierarchy: positions,
              material: groundColor,
              classificationType: Cesium.ClassificationType.TERRAIN
            },
          };

          // Outline
          const outline = await viewer.entities.add({
            polyline: {
              positions: positions,
              width: 2,
              material: darkerColor,
              clampToGround: true,
              classificationType: Cesium.ClassificationType.TERRAIN
            }
          });
          outline.assetType = "polyline"
          outline.show = asset.showDefault
          tilesets.push(outline)
          const tileset = await viewer.entities.add(polygon)
          tileset.assetType = "polygon"
          tileset[asset.payloadKeyname] = individualPayloads[i]
          tileset.surfaceName = asset.names[index]
          tileset.hoverColor = darkerColor
          tileset.color = groundColor
          tileset.show = asset.showDefault
          tilesets.push(tileset)
          console.log(asset)
        }
        // Create stats window
        let finalObject = {
          tilesets, 
          assetType: "multiPolygon",
          [asset.payloadKeyname]: totPayload
        }

        return finalObject
        
      }
    }
  }

  const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(curId);
  await viewer.scene.primitives.add(tileset);
  return tileset
}

async function initializeEntityAsset(assetId) {
  
}

const currentBuildingSetId = []
const activeBuildingSets = []



export async function initializeBuildings() {

  const buttons = [
    { layerId: 'google-3d-tiles', btnText: "Google 3D-tiles" },
    { layerId: 'kp-buildings', btnText: "3D-byggnader" },
    { layerId: 'no-buildings', btnText: "Inga byggnader" }
  ];

  buttons.forEach(({ layerId, btnText }, index) => {
    const button = document.createElement("li")
    const btnId = "buildings-button-" + index
    button.classList.add("nav-item-w-radio", "sub-menu-item")
    button.innerHTML = `
      <label for="${btnId}" class="sub-menu-item__label">${btnText}</label>
      <input type="radio" name="buildings" id="${btnId}" class="nav-radio">
    `
    const parentElem = document.getElementById("layers-sub-menu")
    parentElem.appendChild(button)
    const mountedBtn = document.getElementById(btnId)

    if (mountedBtn) {
      mountedBtn.addEventListener('click', () => {
        //event.preventDefault(); // Prevent default anchor behavior
        handleBuildingsNavClick(layerId);
      });
  
      // Set default choice
      if (layerId === "kp-buildings") {
        mountedBtn.classList.add('active');
        activateBuildingsLayer(layerId);
        mountedBtn.checked = true
      }
    }
  });
}

const buildingLayers = [
  {
    id: "google-3d-tiles",
    ionAssetIds: [0]
  },
  {
    id: 'kp-buildings',
    ionAssetIds: [3531421, 3531425, 3531433, 3531439, 3531443, 3531448, 3531455, 3531460, 3531464, 3531472, 3531538, 3531551, 3531559, 3531566, 3531573, 3531579, 3531587, 3531593],
    needsPerformanceImprovement: true
  },
  {
    id: 'no-buildings',
    ionAssetIds: ['']
  }
]

// Function to activate baselayer
async function activateBuildingsLayer(layerId) {
  if (currentBuildingSetId.includes(layerId)) return

  if (activeBuildingSets.length > 0 || currentBuildingSetId.length > 0 ) {
    for (const buildingSet of activeBuildingSets) {
      viewer.scene.primitives.remove(buildingSet);  
    }
    while (currentBuildingSetId.length > 0) {
      currentBuildingSetId.pop()
    }
  }
  const layer = buildingLayers.find(lay => lay.id === layerId)
  if (!layer) console.error("Layer not found: ", layerId)

  if (layerId === "google-3d-tiles") {
    // Add Photorealistic 3D Tiles
    try {
      const source = await Cesium.createGooglePhotorealistic3DTileset({
        // Only the Google Geocoder can be used with Google Photorealistic 3D Tiles.  Set the `geocode` property of the viewer constructor options to IonGeocodeProviderType.GOOGLE.
        onlyUsingWithGoogleGeocoder: true,
      });

      const tileset = viewer.scene.primitives.add(source);
      activeBuildingSets.push(tileset)
    } catch (error) {
      console.log(`Error loading Photorealistic 3D Tiles tileset.
      ${error}`);
    }
  } else {
    for (const ionAsset of layer.ionAssetIds) {
      const tileSet = layer.id === "no-buildings" ? "" : layer.id === "osm-buildings" ? await Cesium.createOsmBuildingsAsync() : await initializeAsset(ionAsset, layer)
      
      const addedTileset = layer.id === "no-buildings" ? "" : viewer.scene.primitives.add(tileSet)
      if (layer.needsPerformanceImprovement) {
        addedTileset.maximumScreenSpaceError = 32 // Hur nära ifrån byggnaderna börjar visas - Lågt värde = Byggnader visas från långt håll
        addedTileset.dynamicScreenSpaceError = true
        addedTileset.dynamicScreenSpaceErrorDensity = 0.003
        addedTileset.dynamicScreenSpaceErrorFactor = 2
        addedTileset.maximumMemoryUsage = 2048
        addedTileset.skipLevelOfDetail = true;
        addedTileset.baseScreenSpaceError = 512;
        addedTileset.skipScreenSpaceErrorFactor = 8;
      }
      if (addedTileset) {
        activeBuildingSets.push(addedTileset)
      } 
    }
  }
  currentBuildingSetId.push(layerId)
}


function cartesianArrayToDegreesArray(cartesianArray) {
    const degreesArray = [];
    for (const cart of cartesianArray) {
        const cartographic = Cesium.Cartographic.fromCartesian(cart);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        degreesArray.push(lon, lat);
    }
    return degreesArray;
}


export function handleBuildingsNavClick(layerId) {
  activateBuildingsLayer(layerId)
}


function showCustomBuilding(bool, building) {
  building.show = bool
}


async function sampleHighestHeightPointInTerrainUnderBuilding(boundingBox, modelMatrix) {
 
  const corners = [];
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          const corner = new Cesium.Cartesian3();
          Cesium.Matrix3.multiplyByVector(boundingBox.halfAxes, new Cesium.Cartesian3(x, y, z), corner);
          Cesium.Cartesian3.add(corner, boundingBox.center, corner);
          corners.push(Cesium.Matrix4.multiplyByPoint(modelMatrix, corner, new Cesium.Cartesian3()));
        }
      }
    }

    // 🔹 Convert corners to cartographic coordinates
    const cartographicPoints = corners.map(corner => {
      const cartographic = Cesium.Cartographic.fromCartesian(corner);
      return new Cesium.Cartographic(cartographic.longitude, cartographic.latitude, cartographic.height);
    });
    const updatedPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, cartographicPoints);

    // ✅ Find the **highest** terrain height
    const groundHeights = updatedPositions.map(pos => pos.height);
    const highestGroundHeight = Math.max(...groundHeights);

  visualizeSampledTerrainPoints(updatedPositions, highestGroundHeight)

  const originalCenter = Cesium.Cartographic.fromCartesian(boundingBox.center);
  const surface = Cesium.Cartesian3.fromRadians(
    originalCenter.longitude,
    originalCenter.latitude,
    highestGroundHeight
  );

  return surface
}

function visualizeSampledTerrainPoints(updatedPositions, highestGroundHeight) {
  const samplePointDataSource = new Cesium.CustomDataSource("Sampled Terrain Points");
  viewer.dataSources.add(samplePointDataSource);

  updatedPositions.forEach((pos, index) => {
    if (!Cesium.defined(pos.height)) return;

    const position = Cesium.Cartesian3.fromRadians(pos.longitude, pos.latitude, pos.height);
    const isHighest = pos.height === highestGroundHeight;

    samplePointDataSource.entities.add({
      position,
      billboard: {
        image: isHighest ? "img/blue-dot.svg" : 
                          "img/red-dot.svg",
        width: 12,
        height: 12,
        verticalOrigin: Cesium.VerticalOrigin.CENTER
      },
      label: {
        text: `${pos.height.toFixed(2)} m`,
        font: "12px sans-serif",
        fillColor: isHighest ? Cesium.Color.RED : Cesium.Color.BLUE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10)
      }
    });
  });
}