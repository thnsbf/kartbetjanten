// linesUtils.js
import {
  Color,
  Cartesian2,
  VerticalOrigin,
  Cartographic,
  EllipsoidGeodesic,
} from "cesium";

// Returns an array of newly created label entities and attaches them to the viewer
export function rebuildLabelsForLineEntity(viewer, ent) {
  const labels = [];
  const ellipsoid = viewer.scene.globe.ellipsoid;

  // Get raw positions (handle both Constant/Callback properties)
  const positions =
    typeof ent.polyline?.positions?.getValue === "function"
      ? ent.polyline.positions.getValue(viewer.clock.currentTime)
      : ent.polyline?.positions;

  if (!positions || positions.length < 2) return labels;

  // Use draft (if present) to compute offset for the final label
  const DRAFT = ent.__draft || { pointSize: 8, showValues: true };
  const offsetY = Math.max(12, (DRAFT.pointSize ?? 8) + 6);

  // Small helpers
  const fmt = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km` : `${m.toFixed(m < 10 ? 2 : 1)} m`);
  const segLen = (a, b) => {
    const c0 = Cartographic.fromCartesian(a, ellipsoid);
    const c1 = Cartographic.fromCartesian(b, ellipsoid);
    return new EllipsoidGeodesic(c0, c1).surfaceDistance;
  };

  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    const a = positions[i - 1];
    const b = positions[i];
    const meters = segLen(a, b);
    total += meters;

    const isLast = i === positions.length - 1;
    const label = viewer.entities.add({
      position: isLast ? positions[i] : // last at final vertex (we’ll offset vertically)
                        // midpoint on ellipsoid: average cartographics → back to cartesian
                        (() => {
                          const c0 = Cartographic.fromCartesian(a, ellipsoid);
                          const c1 = Cartographic.fromCartesian(b, ellipsoid);
                          const midLon = (c0.longitude + c1.longitude) / 2;
                          const midLat = (c0.latitude + c1.latitude) / 2;
                          return viewer.scene.globe.ellipsoid.cartographicToCartesian
                            ? viewer.scene.globe.ellipsoid.cartographicToCartesian({ longitude: midLon, latitude: midLat, height: 0 })
                            : b; // fallback
                        })(),
      label: {
        text: isLast ? `Total längd: ${fmt(total)}` : fmt(meters),
        font: "14px Barlow",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        pixelOffset: isLast ? new Cartesian2(0, offsetY - 18) : Cartesian2.ZERO,
        verticalOrigin: isLast ? VerticalOrigin.BOTTOM : VerticalOrigin.CENTER,
      },
      show: true,
    });

    labels.push(label);
  }

  return labels;
}

