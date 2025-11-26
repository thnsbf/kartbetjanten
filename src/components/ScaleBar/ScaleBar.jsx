// src/components/ScaleBar/ScaleBar.jsx
import "./ScaleBar.css";

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
// MUST match the constant in zoom-to-scale.js
const METERS_PER_CSS_PIXEL = 0.0254 / 96; // ≈ 0.0002645833 m

function fmtScaleRatioFromMetersPerPixel(metersPerPixelGround) {
  if (!isFinite(metersPerPixelGround) || metersPerPixelGround <= 0) return "";

  // 1 CSS px = METERS_PER_CSS_PIXEL meters at 1:1
  // So at this zoom: metersPerPixelGround / METERS_PER_CSS_PIXEL = scale denominator
  const denom = metersPerPixelGround / METERS_PER_CSS_PIXEL;
  if (!isFinite(denom) || denom <= 0) return "";

  const rounded = Math.round(denom);
  return `1:${rounded.toLocaleString("sv-SE")}`;
}

/**
 * Pick a "nice" distance (in meters) near a given value.
 * Uses multipliers like 1, 1.5, 2, 3, 5, 7.5, 10 × 10^n.
 * Example: 14.8 → 15, 63 → 60, 270 → 300, etc.
 */
function chooseNiceMeters(rawMeters) {
  if (!isFinite(rawMeters) || rawMeters <= 0) return 0;

  const mag = Math.pow(10, Math.floor(Math.log10(rawMeters)));
  const norm = rawMeters / mag; // between ~1 and 10

  const candidatesNorm = [1, 1.5, 2, 3, 5, 7.5, 10];
  let best = candidatesNorm[0] * mag;
  let bestDiff = Math.abs(best - rawMeters);

  for (let i = 1; i < candidatesNorm.length; i++) {
    const v = candidatesNorm[i] * mag;
    const d = Math.abs(v - rawMeters);
    if (d < bestDiff) {
      bestDiff = d;
      best = v;
    }
  }

  return best;
}

export default function ScaleBar({
  viewer,
  // widthPx is the *reference* sample width used to measure scale
  widthPx = 140,
  updateEveryFrame = false,
  minBarPx = 100, // minimum visible width for the bar
  maxBarPx = 260, // optional max, can tweak or ignore
}) {
  const [label, setLabel] = useState("");
  const [scaleLabel, setScaleLabel] = useState("");
  const [barWidthPx, setBarWidthPx] = useState(widthPx);

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

      if (!isFinite(dist) || dist <= 0) {
        setLabel("");
        setScaleLabel("");
        return;
      }

      // Ground meters per *screen* pixel at this zoom:
      const metersPerPixelGround = dist / widthPx;

      // Pick a nice ground distance near the measured one
      const niceMeters = chooseNiceMeters(dist);

      // Corresponding bar width in pixels
      let pixels = niceMeters / metersPerPixelGround;
      if (isFinite(pixels) && pixels > 0) {
        if (minBarPx != null) pixels = Math.max(minBarPx, pixels);
        if (maxBarPx != null) pixels = Math.min(maxBarPx, pixels);
      } else {
        pixels = widthPx;
      }

      setBarWidthPx(pixels);
      setLabel(fmtMetersExact(niceMeters));
      setScaleLabel(fmtScaleRatioFromMetersPerPixel(metersPerPixelGround));
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
  }, [viewer, widthPx, updateEveryFrame, minBarPx, maxBarPx]);

  if (!label) return null;

  return (
    <div className="scale-bar">
      <div className="scale-bar__bar" style={{ width: barWidthPx }} />
      <div className="scale-bar__label-row">
        <span className="scale-bar__label">{label}</span>
        {scaleLabel && (
          <span className="scale-bar__scale">&nbsp;{scaleLabel}</span>
        )}
      </div>
    </div>
  );
}
