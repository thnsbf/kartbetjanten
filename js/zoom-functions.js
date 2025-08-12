import { viewer } from "./viewer.js";



export function flyToLoc(lat, long, alt, h = 0, p = -90, r = 0) {
  const heading = Cesium.Math.toRadians(h)
  const pitch = Cesium.Math.toRadians(p)
  const roll = Cesium.Math.toRadians(r)

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lat, long, alt),
      orientation: {
        heading,
        pitch,
        roll
      }
    });
};

// Heading = Z-axis
// Pitch = Y-axis
// Roll = X-axis


// Heading / Z-axis / Azimuth / North-East-South-West

// 0° => Looking North
// 90° => Looking East
// 180° => Looking South
// 270° => Looking West


// Pitch / Y-axis / Tilt / Looking Up and down

// 0° => Flat/Horizontal view
// 90° => Looking Straight Up
// -90° => Looking Straight Down


// Roll / X-axis / Banking / Tilting Left and Right like airplane roll

// 0° => No roll
// 45° => Tilting Right
// -45° => Tilting Left