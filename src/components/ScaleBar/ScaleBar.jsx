import "./ScaleBar.css";

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

// Approx physical size of 1 CSS pixel at 96 DPI (in meters)
const METERS_PER_CSS_PIXEL = 0.0254 / 96; // ≈ 0.0002645833 m

function fmtScaleRatioExact(distMeters, widthPx) {
  if (!widthPx || !isFinite(distMeters) || distMeters <= 0) return "";

  // Ground meters per *screen* pixel
  const metersPerPixelGround = distMeters / widthPx;

  // How many screen pixels would correspond to 1 meter at that DPI
  // => 1 : denom
  const denom = metersPerPixelGround / METERS_PER_CSS_PIXEL;

  if (!isFinite(denom) || denom <= 0) return "";

  // Round to nearest integer – keeps it “exact” enough and updates on every change
  const rounded = Math.round(denom);

  return `1:${rounded.toLocaleString("sv-SE")}`;
}
export default function ScaleBar({
  viewer,
  widthPx = 140,
  updateEveryFrame = false,
}) {
  const [label, setLabel] = useState("");
  const [scaleLabel, setScaleLabel] = useState("");
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

      const e = scene.globe.ellipsoid;
      const p0 = camera.pickEllipsoid(center, e);
      const p1 = camera.pickEllipsoid(right, e);

      if (!p0 || !p1) {
        setLabel("");
        setScaleLabel("");
        return;
      }

      const c0 = Cartographic.fromCartesian(p0);
      const c1 = Cartographic.fromCartesian(p1);
      geodesic.setEndPoints(c0, c1);
      const dist = geodesic.surfaceDistance; // meters across widthPx pixels

      if (isFinite(dist) && dist > 0) {
        setLabel(fmtMetersExact(dist));
        setScaleLabel(fmtScaleRatioExact(dist, widthPx));
      } else {
        setLabel("");
        setScaleLabel("");
      }
    };

    const schedule = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(update);
    };

    let removeChanged;
    if (!updateEveryFrame) {
      removeChanged = viewer.camera.changed.addEventListener(schedule);
      schedule(); // initial compute
    }

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
    <div className="scale-bar">
      <div className="scale-bar__bar" style={{ width: widthPx }} />
      <div className="scale-bar__label-row">
        <span className="scale-bar__label">{label}</span>
        {scaleLabel && (
          <span className="scale-bar__scale">&nbsp;{scaleLabel}</span>
        )}
      </div>
    </div>
  );
}
