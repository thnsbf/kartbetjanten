import "./ScaleBar.css"

// ScaleBar.jsx
import { useEffect, useRef, useState } from "react";
import { Cartographic, EllipsoidGeodesic } from "cesium";

function fmtMetersExact(m) {
  if (m >= 1000) {
    const km = m / 1000;
    return `${km.toFixed(km < 10 ? 2 : 1)} km`;
  }
  // show more precision when small
  return `${m.toFixed(m < 10 ? 2 : 1)} m`;
}

export default function ScaleBar({ viewer, widthPx = 140, updateEveryFrame = false }) {
  const [label, setLabel] = useState("");
  const rafRef = useRef(null);
  const geodesicRef = useRef(new EllipsoidGeodesic());

  useEffect(() => {
    if (!viewer) return;

    const { scene, camera } = viewer;
    const canvas = scene.canvas;
    const geodesic = geodesicRef.current;

    const update = () => {
      rafRef.current = null;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;

      // sample center and center + widthPx to the right
      const center = { x: Math.round(w / 2), y: Math.round(h / 2) };
      const right = { x: Math.round(w / 2 + widthPx), y: Math.round(h / 2) };

      // Ellipsoid pick (works with your top-down ellipsoid setup)
      const e = scene.globe.ellipsoid;
      const p0 = camera.pickEllipsoid(center, e);
      const p1 = camera.pickEllipsoid(right, e);

      if (!p0 || !p1) {
        setLabel("");
        return;
      }

      const c0 = Cartographic.fromCartesian(p0);
      const c1 = Cartographic.fromCartesian(p1);
      geodesic.setEndPoints(c0, c1);
      const dist = geodesic.surfaceDistance; // meters across widthPx pixels

      if (isFinite(dist) && dist > 0) {
        setLabel(fmtMetersExact(dist));
      } else {
        setLabel("");
      }
    };

    const schedule = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(update);
    };

    // Option A: refresh on camera changes (efficient; updates whenever you zoom/pan)
    let removeChanged;
    if (!updateEveryFrame) {
      removeChanged = viewer.camera.changed.addEventListener(schedule);
      schedule(); // initial compute
    }

    // Option B: refresh every frame (smoothest); toggle with prop
    const postRenderCb = () => schedule();
    if (updateEveryFrame) {
      scene.postRender.addEventListener(postRenderCb);
    }

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (removeChanged) removeChanged();
      if (updateEveryFrame) scene.postRender.removeEventListener(postRenderCb);
    };
  }, [viewer, widthPx, updateEveryFrame]);

  if (!label) return null;

  return (
    <div
      className="scale-bar"
    >
      <div className="scale-bar__bar" style={{width: widthPx}} />
      <div className="scale-bar__label">{label}</div>
    </div>
  );
}
