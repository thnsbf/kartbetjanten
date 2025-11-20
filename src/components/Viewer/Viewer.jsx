import {
  Viewer,
  Ion,
  EllipsoidTerrainProvider,
  Rectangle,
  Camera,
  WebMapServiceImageryProvider,
  ScreenSpaceEventType,
  Color,
  ScreenSpaceEventHandler,
  UrlTemplateImageryProvider,
} from "cesium";
import { useEffect, useRef, useState } from "react";
import "cesium/Build/Cesium/Widgets/widgets.css";

import MouseMoveCoordinates from "../MouseMoveCoordinates/MouseMoveCoordinates";
import ScaleBar from "../ScaleBar/ScaleBar";
import { zoomToNextScaleStep } from "../../modules/zoom-to-scale";
import { zoomTo } from "../../modules/utils";

// Tools
import AddMarker from "../Tools/AddMarker/AddMarker";
import AddText from "../Tools/AddText/AddText";
import DrawLines from "../Tools/DrawLines/DrawLines";
import DrawArea from "../Tools/DrawArea/DrawArea";
import MoveTool from "../Tools/MoveTool/MoveTool";

// Helpers used by MoveTool (and sometimes DrawLines/DrawArea)
import { segmentInfo, formatMeters } from "../Tools/DrawLines/linesDraft";
import {
  polygonCentroid,
  polygonAreaMeters2,
  formatSquareMeters,
} from "../Tools/DrawArea/areaDraft";

const extent = Rectangle.fromDegrees(
  11.10770320892334,
  69.05996720139402,
  24.155517578125,
  55.33778335768852
);
Camera.DEFAULT_VIEW_RECTANGLE = extent;
Camera.DEFAULT_VIEW_FACTOR = 0;

Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1NTdkOTBlZi1hODJlLTQ5ODktOTdhZC01NDMxNDU0ZTg1MTMiLCJpZCI6MTE0MzEyLCJpYXQiOjE2NjgwMDE4OTl9.XnYVR35D4XVls91_O2vo72ovO4yOEuk71I2l2Jv-zQs";

export default function Globe({
  pickedAddress,
  onReady,
  activeTool,
  setActiveTool,
  setEntitiesRef,
  entitiesUpdateUI,
  entitiesRef,
  onRequestPlaceText, // AddText → opens modal in SidebarRight
  onCancelPlaceText,
  onPickEdit, // NEW: callback to open the right edit modal from a click in the map
}) {
  const mountRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  const [lon, lat] = pickedAddress.geometry.coordinates;

  useEffect(() => {
    const v = new Viewer(mountRef.current, {
      terrainProvider: new EllipsoidTerrainProvider(),

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
      contextOptions: {
        webgl: { preserveDrawingBuffer: true },
      },
    });
    v.scene.globe.baseColor = Color.fromCssColorString("rgb(236, 236, 236)");

    // Basemap
    v.imageryLayers.addImageryProvider(
      new WebMapServiceImageryProvider({
        url: "https://kartportalen.trollhattan.se/wms?servicename=wms_publicering&",
        layers: "theme-baskarta",
        parameters: { transparent: true, format: "image/png" },
      })
    );

    // Camera feel/setup
    const ssc = v.scene.screenSpaceCameraController;
    ssc.enableTilt = false;
    ssc.enableLook = false;
    ssc.tiltEventTypes = [];
    ssc.lookEventTypes = [];
    ssc.enableZoom = false;
    ssc.minimumZoomDistance = 20;
    ssc.maximumZoomDistance = 1e7;
    ssc.inertiaSpin = 0;
    ssc.inertiaZoom = 0;
    ssc.inertiaTranslate = 0;

    // Smooth wheel zoom to scale steps
    const STEP_DELTA = 100;
    let accum = 0;
    let raf = null;

    const canvas = v.scene.canvas;
    function onWheel(e) {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= 800;
      accum += delta;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        while (Math.abs(accum) >= STEP_DELTA) {
          const dir = accum > 0 ? +1 : -1;
          zoomToNextScaleStep(v, dir, 140);
          accum -= dir * STEP_DELTA;
        }
      });
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    function cleanupWheel() {
      canvas.removeEventListener("wheel", onWheel, { passive: false });
      if (raf) cancelAnimationFrame(raf);
    }

    // Remove Cesium default double click (tilt/zoom)
    v.screenSpaceEventHandler.removeInputAction(
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );

    // Start view
    zoomTo(v, lon, lat);

    onReady?.(v);
    setViewer(v);

    return () => {
      cleanupWheel();
      v.destroy();
    };
  }, [onReady]);

  // --- NEW: Click-to-edit when no tool is active --------------------------------

  // Resolve a clicked child (point/label/etc.) back to its "root" entity
  function resolveRootEntity(pickedEnt) {
    if (!pickedEnt) return null;
    if (pickedEnt.__parent) return pickedEnt.__parent;

    // Fall back: scan entitiesRef to find which entity owns this child
    const map = entitiesRef?.current;
    if (!map) return pickedEnt;
    for (const [, candidate] of map.entries()) {
      const ch = candidate.__children || {};
      const inPoints =
        Array.isArray(ch.points) && ch.points.includes(pickedEnt);
      const inLabels =
        (Array.isArray(ch.labels) && ch.labels.includes(pickedEnt)) ||
        (Array.isArray(ch.edgeLabels) && ch.edgeLabels.includes(pickedEnt)) ||
        (ch.totalLabel && ch.totalLabel === pickedEnt) ||
        (ch.label && ch.label === pickedEnt);
      if (inPoints || inLabels) return candidate;
    }
    return pickedEnt;
  }

  useEffect(() => {
    if (!viewer) return;

    // Only attach when *no tool* is active
    if (activeTool !== "no-tool") return;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction(({ position }) => {
      try {
        const picked = viewer.scene.pick(position);
        if (!picked || !picked.id) return;

        const root = resolveRootEntity(picked.id);
        if (!root) return;

        // Only react to our app's root entities (Area, Linje, Punkt, Text)
        const uuid =
          root.id ??
          root._id ??
          root.__uuid ??
          (typeof root.id === "string" ? root.id : null);
        if (!uuid) return;

        // Ensure this is one of the entities we track in the list
        if (!entitiesRef?.current?.has(uuid)) return;

        // Open the correct modal via parent callback
        onPickEdit?.(uuid);
      } catch {
        /* ignore picks we don't own */
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      try {
        handler.destroy();
      } catch {}
    };
  }, [viewer, activeTool, onPickEdit, entitiesRef]);

  return (
    <>
      <div
        id="cesiumContainer"
        ref={mountRef}
        style={{ width: "100%", height: "100vh" }}
      />
      {/* <MouseMoveCoordinates viewer={viewer} /> */}
      <ScaleBar viewer={viewer} updateEveryFrame />

      {/* MARKER */}
      <AddMarker
        viewer={viewer}
        active={activeTool === "place-dot"}
        onCancel={() => setActiveTool("no-tool")}
        setEntitiesRef={setEntitiesRef}
      />

      {/* TEXT (click to open modal in SidebarRight) */}
      <AddText
        viewer={viewer}
        active={activeTool === "place-text"}
        onRequestPlaceText={onRequestPlaceText}
        onCancel={() => {
          // Cancel the whole "place text" flow including SidebarRight
          if (onCancelPlaceText) {
            onCancelPlaceText();
          } else {
            // Fallback, in case you ever reuse AddText in another context
            setActiveTool("no-tool");
          }
        }}
      />

      {/* LINES */}
      <DrawLines
        viewer={viewer}
        active={activeTool === "draw-lines"}
        onDone={() => setActiveTool("no-tool")}
        onCancel={() => setActiveTool("no-tool")}
        setEntitiesRef={setEntitiesRef}
        entitiesUpdateUI={entitiesUpdateUI}
      />

      {/* AREA */}
      <DrawArea
        viewer={viewer}
        active={activeTool === "draw-area"}
        onCancel={() => setActiveTool("no-tool")}
        onDone={() => setActiveTool("no-tool")}
        setEntitiesRef={setEntitiesRef}
        entitiesUpdateUI={entitiesUpdateUI}
      />

      {/* MOVE/DRAG */}
      <MoveTool
        viewer={viewer}
        active={activeTool === "move-object"}
        onCancel={() => setActiveTool("no-tool")}
        entitiesRef={entitiesRef}
        entitiesUpdateUI={entitiesUpdateUI}
        lineHelpers={{ segmentInfo, formatMeters }}
        areaHelpers={{
          polygonCentroid,
          polygonAreaMeters2,
          formatSquareMeters,
        }}
      />
    </>
  );
}
