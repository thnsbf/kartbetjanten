

export async function sampleTerrainFromDegrees(lon, lat, terrainProvider, offset = 1.75) {

  const cartogLoc = Cesium.Cartographic.fromDegrees(lon, lat)
  const terrainSample = await Cesium.sampleTerrainMostDetailed(terrainProvider, [cartogLoc]);
  const sampledHeight = terrainSample[0].height
  const pointHeight = sampledHeight + offset

  return pointHeight
}

export async function sampleTerrainFromCartesian(cartesian, terrainProvider, heightOffset = 1.75) {
  const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian);

  // Sample the most detailed terrain height
  const terrainSample = await Cesium.sampleTerrainMostDetailed(terrainProvider, [cartographic]);

  const sampledHeight = terrainSample[0].height;
  const pointHeight = sampledHeight + heightOffset;

  return pointHeight;
}

export function convertCartesianToDegrees(cartesian) {
  const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(cartesian);
  return { 
    longitude: Cesium.Math.toDegrees(cartographic.longitude), 
    latitude: Cesium.Math.toDegrees(cartographic.latitude) 
  }
}

export function addMetersToLongLat(lon, lat, meters) {

  const height = 0;

  // Convert to Cartesian
  const cartesian = Cesium.Cartesian3.fromDegrees(lon, lat, height);

  // East direction vector
  const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(cartesian);
  const east = Cesium.Matrix4.getColumn(enuTransform, 0, new Cesium.Cartesian3());

  // Scale the east vector by 100 meters
  const translation = Cesium.Cartesian3.multiplyByScalar(east, meters, new Cesium.Cartesian3());

  // Apply translation
  const newCartesian = Cesium.Cartesian3.add(cartesian, translation, new Cesium.Cartesian3());

  // Convert back to lon/lat
  const newCartographic = Cesium.Cartographic.fromCartesian(newCartesian);
  const newLon = Cesium.Math.toDegrees(newCartographic.longitude);
  const newLat = Cesium.Math.toDegrees(newCartographic.latitude);

  console.log(`New position: Lat: ${newLat}, Lon: ${newLon}`);
  return { longitude: newLon, latitude: newLat }
}

export function drawAxes(viewer, position, right, up, direction) {
  const scale = 100.0;

  viewer.entities.add({
      name: "X - right",
      polyline: {
          positions: [position, Cesium.Cartesian3.add(position, Cesium.Cartesian3.multiplyByScalar(right, scale, new Cesium.Cartesian3()), new Cesium.Cartesian3())],
          width: 2,
          material: Cesium.Color.RED
      }
  });

  viewer.entities.add({
      name: "Y - up",
      polyline: {
          positions: [position, Cesium.Cartesian3.add(position, Cesium.Cartesian3.multiplyByScalar(up, scale, new Cesium.Cartesian3()), new Cesium.Cartesian3())],
          width: 2,
          material: Cesium.Color.GREEN
      }
  });

  viewer.entities.add({
      name: "Z - forward",
      polyline: {
          positions: [position, Cesium.Cartesian3.add(position, Cesium.Cartesian3.multiplyByScalar(direction, scale, new Cesium.Cartesian3()), new Cesium.Cartesian3())],
          width: 2,
          material: Cesium.Color.BLUE
      }
  });
}


/**
 * Orients the camera based on the local ENU frame so that the frustum
 * aligns with the Earth's surface curvature at the given location.
 *
 * @param {Cesium.Camera} camera - The Cesium camera to orient.
 * @param {Cartesian3} position - The camera's position in world coordinates.
 * @param {Cartesian3} target - The point the camera should look at.
 */
export function orientCameraToSurface(camera, position, target) {
  // Raw direction vector from camera to target
  const direction = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(target, position, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  // Get ENU up vector at position
  const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(position);
  const upHint = Cesium.Matrix4.getColumn(enuTransform, 2, new Cesium.Cartesian3());

  // Calculate a corrected right vector (orthogonal to direction and upHint)
  const right = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.cross(direction, upHint, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  // Now re-calculate up to ensure 100% orthogonality
  const up = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.cross(right, direction, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
  );

  // Apply to lightCamera
  camera.position = position;
  camera.direction = direction;
  camera.up = up;
  camera.right = right;
}

export function isValidCartesian(cartesian) {
  return (
      Cesium.defined(cartesian) &&
      isFinite(cartesian.x) &&
      isFinite(cartesian.y) &&
      isFinite(cartesian.z)
  );
}

export function isValidCartesian3(cart) {
  return (
      Cesium.defined(cart) &&
      typeof cart.x === 'number' &&
      typeof cart.y === 'number' &&
      typeof cart.z === 'number' &&
      isFinite(cart.x) &&
      isFinite(cart.y) &&
      isFinite(cart.z)
  );
}
