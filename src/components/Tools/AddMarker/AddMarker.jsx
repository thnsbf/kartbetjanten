// src/components/Tools/AddMarker/AddMarker.jsx
import { useEffect } from "react";
import { ScreenSpaceEventHandler, ScreenSpaceEventType } from "cesium";
import { v4 as uuidv4 } from "uuid";
import { defaultMarkerDraft, toCesiumColor } from "./markersDraft";

export default function AddMarker({ viewer, active, onPlaced, onCancel, setEntitiesRef }) {
  useEffect(() => {
    if (!viewer || !active) return;

    const canvas = viewer.scene.canvas;
    const handler = new ScreenSpaceEventHandler(canvas);
    const DRAFT = { ...defaultMarkerDraft };

    canvas.style.cursor = "crosshair";

    handler.setInputAction((e) => {
      const p = viewer.camera.pickEllipsoid(e.position, viewer.scene.globe.ellipsoid);
      if (!p) return;

      const uuid = uuidv4();
      const addedObject = viewer.entities.add({
        position: p,
        point: {
          pixelSize: DRAFT.size,
          color: toCesiumColor(DRAFT.color),
          outlineColor: toCesiumColor(DRAFT.outlineColor),
          outlineWidth: DRAFT.outlineWidth,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        id: uuid,
        isActive: true,
        lastUpdated: new Date().toISOString(),
        type: "Punkt",
        show: true,
      });

      // persist draft for editing later
      addedObject.__draft = { ...DRAFT };
      setEntitiesRef(uuid, addedObject);
      onPlaced?.();
    }, ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => onCancel?.(), ScreenSpaceEventType.RIGHT_CLICK);

    const onKey = (ev) => { if (ev.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", onKey);

    return () => {
      handler.destroy();
      window.removeEventListener("keydown", onKey);
      canvas.style.cursor = "default";
    };
  }, [viewer, active, onPlaced, onCancel, setEntitiesRef]);

  return null;
}
