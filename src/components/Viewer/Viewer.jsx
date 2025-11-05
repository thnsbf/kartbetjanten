
import { Viewer, Ion, EllipsoidTerrainProvider, Rectangle, Camera, Cartesian3, Math as CesiumMath, UrlTemplateImageryProvider, ScreenSpaceEventType, CameraEventType, WebMapServiceImageryProvider } from 'cesium';
import { useEffect, useRef, useState } from 'react';
import "cesium/Build/Cesium/Widgets/widgets.css";
import MouseMoveCoordinates from '../MouseMoveCoordinates/MouseMoveCoordinates';
import ScaleBar from '../ScaleBar/ScaleBar';
import { zoomToNextScaleStep } from '../../modules/zoom-to-scale';
import { zoomTo } from '../../modules/utils';
import AddMarker from '../Tools/AddMarker/AddMarker';
import AddText from '../Tools/AddText/AddText';
import DrawLines from "../Tools/DrawLines/DrawLines";
import DrawArea from "../Tools/DrawArea/DrawArea";
import MoveTool from "../Tools/MoveTool/MoveTool";
import { segmentInfo, formatMeters } from '../Tools/DrawLines/linesDraft';
import { polygonCentroid, polygonAreaMeters2, formatSquareMeters } from '../Tools/DrawArea/areaDraft';

var extent = Rectangle.fromDegrees(11.10770320892334, 69.05996720139402, 24.155517578125, 55.33778335768852);
    Camera.DEFAULT_VIEW_RECTANGLE = extent;
    Camera.DEFAULT_VIEW_FACTOR = 0;

    Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1NTdkOTBlZi1hODJlLTQ5ODktOTdhZC01NDMxNDU0ZTg1MTMiLCJpZCI6MTE0MzEyLCJpYXQiOjE2NjgwMDE4OTl9.XnYVR35D4XVls91_O2vo72ovO4yOEuk71I2l2Jv-zQs';

export default function Globe({ pickedAddress, onReady, activeTool, setActiveTool, setEntitiesRef, entitiesUpdateUI, entitiesRef }) {
  const mountRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  const [lon, lat] = pickedAddress.geometry.coordinates
  // Updating myObjects

  useEffect(() => {
    const v = new Viewer(mountRef.current, {
      terrainProvider: new EllipsoidTerrainProvider(),
      imageryProvider: false,
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
    });

    // Disable default doble-click, which would tilt the camera

   /*  v.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    v.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.RIGHT_DOUBLE_CLICK); */

    v.imageryLayers.addImageryProvider(
      new WebMapServiceImageryProvider({
    url:
      "https://kartportalen.trollhattan.se/wms?servicename=wms_cesium",
    layers: "theme-baskarta",
    parameters: {
      transparent: true,
      format: "image/png",
    },
  }));

    


    /* v.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        credit: "© OpenStreetMap contributors",
      })
    ); */
    const ssc = v.scene.screenSpaceCameraController;
    const STEP_DELTA = 100;       // ~one wheel "notch" in most browsers
    ssc.enableTilt = false;
    ssc.enableLook = false;
    ssc.tiltEventTypes = [];   // or [ ] to remove all tilt gestures
    ssc.lookEventTypes = [];  
    let accum = 0;
    let raf = null;
    ssc.inertiaSpin = 0;
    ssc.inertiaZoom = 0;
    ssc.inertiaTranslate = 0;


    v.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    const canvas = v.scene.canvas;

    function onWheel(e) {
      // Prevent Cesium / browser from handling the wheel
      e.preventDefault();

      // Normalize delta across devices (pixels vs lines/pages)
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;     // lines -> ~pixels
      else if (e.deltaMode === 2) delta *= 800; // pages -> ~pixels

      // Trackpads generate many tiny deltas; accumulate to full "steps"
      accum += delta;

      // Batch to animation frame to avoid spamming
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;

        // For each full STEP_DELTA, trigger one step of your zoom
        while (Math.abs(accum) >= STEP_DELTA) {
      const dir = accum > 0 ? +1 : -1; // down=out, up=in
      // SNAP to your “nice” scale list on each notch:
      zoomToNextScaleStep(v, dir, 140); // 140 MUST match ScaleBar widthPx
      accum -= dir * STEP_DELTA;
    }
      });
    }

canvas.addEventListener("wheel", onWheel, { passive: false });

// Clean up when disposing the viewer/component:
function cleanupWheel() {
  canvas.removeEventListener("wheel", onWheel, { passive: false });
  if (raf) cancelAnimationFrame(raf);
}


// 1) Set the camera looking straight down (nadir)
    zoomTo(v, lon, lat)

    ssc.enableTilt = false;
    ssc.enableLook = false;
    ssc.enableZoom = false;
    ssc.minimumZoomDistance = 20;   // prevent getting too close
    ssc.maximumZoomDistance = 1e7; // prevent flying into space
    ssc.tiltEventTypes = [];  // or undefined
    ssc.lookEventTypes = [];  // or undefined
    onReady?.(v); // hand the instance to parent
    setViewer(v);
    return () => { 
      cleanupWheel()
      v.destroy()

    };
  }, [onReady]);

  return (
    <>
      <div id="cesiumContainer" ref={mountRef} style={{ width: "100%", height: "100vh" }} />
      <MouseMoveCoordinates viewer={viewer} />
      <ScaleBar viewer={viewer} updateEveryFrame />
      <AddMarker
        viewer={viewer}
        active={activeTool === "place-dot"}
        onCancel={() => setActiveTool("no-tool")}
        setEntitiesRef={setEntitiesRef}
      />
      <AddText
        viewer={viewer}
        active={activeTool === "place-text"}
        onCancel={() => setActiveTool("no-tool")}
        setEntitiesRef={setEntitiesRef}
        entitiesUpdateUI={entitiesUpdateUI}
      />
      <DrawLines
        viewer={viewer}
        active={activeTool === "draw-lines"}
        onDone={() => setActiveTool("no-tool")}
        onCancel={() => setActiveTool("no-tool")}
        setEntitiesRef={setEntitiesRef}
        entitiesUpdateUI={entitiesUpdateUI}
      />
      <DrawArea
        viewer={viewer}
        active={activeTool === "draw-area"}
        onCancel={() => setActiveTool("no-tool")}
        onDone={() => setActiveTool("no-tool")}
        setEntitiesRef={setEntitiesRef}
        entitiesUpdateUI={entitiesUpdateUI}
      />
      <MoveTool
        viewer={viewer}
        active={activeTool === "move-object"}
        onCancel={() => setActiveTool("no-tool")}
        entitiesRef={entitiesRef}
        entitiesUpdateUI={entitiesUpdateUI}
        lineHelpers={{
          // pass the same helpers you already use in linesDraft / DrawLines
          segmentInfo,         // (p0, p1, ellipsoid) => { meters, mid }
          formatMeters,        // (m) => string
        }}
        areaHelpers={{
          // from your areaDraft
          polygonCentroid,     // (positions, ellipsoid) => Cartesian3
          polygonAreaMeters2,  // (positions, ellipsoid) => number
          formatSquareMeters,  // (m2) => string
        }}
      />
    </>
  );
}
