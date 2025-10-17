export function addZonesAsRectangles(viewer, zones) {
  const entities = [];

  for (const [name, corners] of Object.entries(zones)) {
    // corners: [[lat1, lon1], [lat2, lon2]]
    const [[lat1, lon1], [lat2, lon2]] = corners;

    // Normalize to west,south,east,north (lon/lat order)
    const west  = Math.min(lon1, lon2);
    const east  = Math.max(lon1, lon2);
    const south = Math.min(lat1, lat2);
    const north = Math.max(lat1, lat2);

    const rectangle = Cesium.Rectangle.fromDegrees(west, south, east, north);

    const e = viewer.entities.add({
      name,
      rectangle: {
        coordinates: rectangle,
        material: Cesium.Color.fromRandom({ alpha: 0.25 }), // semi-transparent fill
        outline: true,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2
        // height: 0,               // uncomment to place at 0m above ellipsoid
        // extrudedHeight: 20        // uncomment to give them a small wall height
      },
      // optional label in the center
      position: Cesium.Cartesian3.fromDegrees(
        (west + east) / 2,
        (south + north) / 2
      ),
      label: {
        text: name,
        font: "14px sans-serif",
        showBackground: true,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    entities.push(e);
  }

  // Zoom to all rectangles
  if (entities.length) viewer.zoomTo(entities);
}

