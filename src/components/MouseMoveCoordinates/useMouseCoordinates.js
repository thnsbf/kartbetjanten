import { useEffect, useRef, useState } from "react";
import proj4 from "proj4";
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Math as CesiumMath,
} from "cesium";
import { lift } from "../../modules/utils";

// Define the CRSs once
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs");
proj4.defs(
  "EPSG:3007",
  "+proj=tmerc +lat_0=0 +lon_0=12 +k=1 +x_0=150000 +y_0=0 +ellps=GRS80 +units=m +no_defs"
);

/**
 * Attach mousemove handler to a Cesium Viewer and return live coords.
 * Returns null when pointer is off the globe.
 */
export function useMouseCoordinates(viewer) {
  const [coords, setCoords] = useState(null);
  const rafFlag = useRef(null);
  const handlerRef = useRef(null);

  useEffect(() => {
    if (!viewer) return;

    handlerRef.current?.destroy();

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;

    handler.setInputAction((movement) => {
      if (rafFlag.current != null) return;
      rafFlag.current = requestAnimationFrame(() => {
        rafFlag.current = null;

        const { scene, camera } = viewer;

        // Ellipsoid-only (no terrain)
        const cartesian = camera.pickEllipsoid(
          movement.endPosition,
          scene.globe.ellipsoid
        );
        // If you enable terrain later, use pickPosition (keep ellipsoid fallback):
        // if (scene.pickPositionSupported) {
        //   cartesian = scene.pickPosition(movement.endPosition) || cartesian;
        // }

        if (!cartesian) {
          setCoords(null);
          return;
        }

        const carto = Cartographic.fromCartesian(cartesian);
        const lon = CesiumMath.toDegrees(carto.longitude);
        const lat = CesiumMath.toDegrees(carto.latitude);

        const [x3007, y3007] = proj4("EPSG:4326", "EPSG:3007", [lon, lat]);

        setCoords({ lon, lat, x3007, y3007 });
      });
    }, ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      if (rafFlag.current != null) cancelAnimationFrame(rafFlag.current);
      handler.destroy();
      handlerRef.current = null;
    };
  }, [viewer]);

  return coords;
}
