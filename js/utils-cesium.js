export async function sampleTerrainHeight(viewer, cartesian) {
  const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian);
  const updatedPositions = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [cartographic]);
  const height = updatedPositions[0].height;
  return parseFloat(height)
}

function isPointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export async function sampleMinimumTerrainHeightUnderPolygon(viewer, hierarchyInput, spacingMeters = 10) {
  const hierarchy = hierarchyInput.positions ? hierarchyInput : { positions: hierarchyInput };
  const positions = hierarchy.positions;

  if (!Array.isArray(positions) || positions.length < 3) {
    throw new Error("Invalid or missing polygon positions.");
  }

  const validPositions = positions.filter(p =>
  p instanceof Cesium.Cartesian3 &&
  typeof p.x === 'number' &&
  typeof p.y === 'number' &&
  typeof p.z === 'number'
);
  const cartographics = [];
  for (const pos of validPositions) {
    try {
      const carto = Cesium.Cartographic.fromCartesian(pos);
      cartographics.push(carto);
    } catch (e) {
      console.warn("Conversion to Cartographic failed:", pos, e);
    }
  }
  const polygonDegrees = cartographics.map(c => [
    Cesium.Math.toDegrees(c.longitude),
    Cesium.Math.toDegrees(c.latitude)
  ]);

  const lats = polygonDegrees.map(c => c[1]);
  const lons = polygonDegrees.map(c => c[0]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const delta = spacingMeters / 111320;
  const sampledPoints = [];

  for (let lat = minLat; lat <= maxLat; lat += delta) {
    for (let lon = minLon; lon <= maxLon; lon += delta) {
      if (isPointInPolygon([lon, lat], polygonDegrees)) {
        sampledPoints.push(Cesium.Cartographic.fromDegrees(lon, lat));
      }
    }
  }

  if (sampledPoints.length === 0) {
    console.warn("No valid terrain sample points found within polygon bounds.");
    return 0;
  }

  const updatedPoints = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, sampledPoints);
  return Math.min(...updatedPoints.map(p => p.height));
}



export function waitForTerrainToLoad(viewer, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let start = Date.now();

    const removeListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener((remaining) => {
      if (remaining === 0) {
        removeListener();
        resolve();
      }
    });

    // Optional timeout guard to avoid hanging indefinitely
    const checkTimeout = () => {
      if (Date.now() - start > timeout) {
        removeListener();
        reject(new Error("Terrain load timed out."));
      } else {
        requestAnimationFrame(checkTimeout);
      }
    };

    checkTimeout();
  });
}

export async function arbitraryPause(ms = 5000) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, ms);
  });
}