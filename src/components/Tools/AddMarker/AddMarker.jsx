// src/components/Tools/AddMarker/AddMarker.jsx
import { useEffect } from "react";
import { ScreenSpaceEventHandler, ScreenSpaceEventType } from "cesium";
import { v4 as uuidv4 } from "uuid";
import {
  defaultMarkerDraft,
  applyDraftToMarkerEntity,
} from "./markersDraft.js";
import { lift } from "../../../modules/utils.js";

export default function AddMarker({
  viewer,
  active,
  onPlaced,
  onCancel,
  setEntitiesRef,
}) {
  useEffect(() => {
    if (!viewer || !active) return;

    const canvas = viewer.scene.canvas;
    const handler = new ScreenSpaceEventHandler(canvas);
    const DRAFT = { ...defaultMarkerDraft };

    canvas.style.cursor = "crosshair";

    handler.setInputAction((e) => {
      const p = viewer.camera.pickEllipsoid(
        e.position,
        viewer.scene.globe.ellipsoid
      );
      if (!p) return;

      const uuid = uuidv4();

      // Create a bare entity first
      const ent = viewer.entities.add({
        position: p,
        id: uuid,
        isActive: true,
        lastUpdated: new Date().toISOString(),
        type: "Punkt",
        show: true,
      });

      // Apply current draft: attaches a point (dot) or a scaled billboard (SVG)
      applyDraftToMarkerEntity(ent, DRAFT);

      // persist draft for editing later
      ent.__draft = { ...DRAFT };

      setEntitiesRef(uuid, ent);
      onPlaced?.();
    }, ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(
      () => onCancel?.(),
      ScreenSpaceEventType.RIGHT_CLICK
    );

    const onKey = (ev) => {
      if (ev.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      handler.destroy();
      window.removeEventListener("keydown", onKey);
      canvas.style.cursor = "default";
    };
  }, [viewer, active, onPlaced, onCancel, setEntitiesRef]);

  return null;
}
