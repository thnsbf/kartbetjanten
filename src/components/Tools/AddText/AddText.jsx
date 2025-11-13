import { useEffect } from "react";
import { ScreenSpaceEventHandler, ScreenSpaceEventType } from "cesium";

/**
 * AddText only captures a map click and notifies parent to open the TextModal in SidebarRight.
 * It does NOT create the entity itself.
 */
export default function AddText({
  viewer,
  active,
  onRequestPlaceText,
  onCancel,
}) {
  useEffect(() => {
    if (!viewer || !active) return;

    const canvas = viewer.scene.canvas;
    const handler = new ScreenSpaceEventHandler(canvas);
    canvas.style.cursor = "text";

    // Left click -> pick position and tell parent to open modal
    handler.setInputAction((e) => {
      const p = viewer.camera.pickEllipsoid(
        e.position,
        viewer.scene.globe.ellipsoid
      );
      if (!p) return;
      onRequestPlaceText?.(p);
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Right click -> cancel
    handler.setInputAction(
      () => onCancel?.(),
      ScreenSpaceEventType.RIGHT_CLICK
    );

    // ESC -> cancel
    const onKey = (ev) => {
      if (ev.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      handler.destroy();
      window.removeEventListener("keydown", onKey);
      canvas.style.cursor = "default";
    };
  }, [viewer, active, onRequestPlaceText, onCancel]);

  return null;
}