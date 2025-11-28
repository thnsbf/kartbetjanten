import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Draw a DOM node to an Image (via html2canvas), then blit onto `ctx`
 * at the element's position relative to mainEl. Accounts for output scale.
 */
async function drawDomOverlayToCanvas(ctx, el, mainEl, outScale = 2) {
  if (!el || !ctx || !mainEl) return;

  const mainRect = mainEl.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();

  // Position within the main box (in CSS px)
  const xCss = Math.max(0, elRect.left - mainRect.left);
  const yCss = Math.max(0, elRect.top - mainRect.top);

  const ss = Math.max(outScale, Math.floor(window.devicePixelRatio || 2));
  const overlayCanvas = await html2canvas(el, {
    backgroundColor: null,
    scale: ss,
    useCORS: true,
    logging: false,
  });

  // IMPORTANT: multiply destination position by the same scale
  ctx.drawImage(overlayCanvas, Math.round(xCss * ss), Math.round(yCss * ss));
}

/**
 * Export ONLY the visible area inside <main class="main"> to a PDF.
 * Crops the Cesium canvas to <main> and composites overlays (ScaleBar, etc.).
 *
 * NEW: optional `headerText` is rendered above the map in the PDF only
 * (not visible in the browser UI).
 */
export async function exportMainViewportToPdf(
  viewer,
  mainEl,
  {
    filename = "min-karta.pdf",
    resolutionScale = Math.max(2, Math.floor(window.devicePixelRatio || 2)),
    margin = 0,
    extraOverlaySelectors = [],
    headerText = null, // 👈 NEW: string shown only in the PDF
  } = {}
) {
  if (!viewer || !mainEl) return;

  const sceneCanvas = viewer.scene?.canvas;
  if (!sceneCanvas) return;

  // Force a render right before we sample pixels
  try {
    viewer.scene.requestRender();
    await new Promise((r) => requestAnimationFrame(r));
  } catch {}

  // Compute crop rect = intersection of Cesium canvas with <main>
  const mainRect = mainEl.getBoundingClientRect();
  const cvRect = sceneCanvas.getBoundingClientRect();

  const ixLeft = Math.max(mainRect.left, cvRect.left);
  const ixTop = Math.max(mainRect.top, cvRect.top);
  const ixRight = Math.min(mainRect.right, cvRect.right);
  const ixBottom = Math.min(mainRect.bottom, cvRect.bottom);

  const cropW = Math.max(0, ixRight - ixLeft);
  const cropH = Math.max(0, ixBottom - ixTop);
  if (cropW === 0 || cropH === 0) return;

  // Output canvas at desired resolution
  const outW = Math.round(cropW * resolutionScale);
  const outH = Math.round(cropH * resolutionScale);
  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const ctx = outCanvas.getContext("2d");

  // Copy the visible part of the Cesium canvas
  const sx = (ixLeft - cvRect.left) * (sceneCanvas.width / cvRect.width);
  const sy = (ixTop - cvRect.top) * (sceneCanvas.height / cvRect.height);
  const sWidth = cropW * (sceneCanvas.width / cvRect.width);
  const sHeight = cropH * (sceneCanvas.height / cvRect.height);

  ctx.drawImage(
    sceneCanvas,
    sx,
    sy,
    sWidth,
    sHeight, // source (WebGL canvas pixels)
    0,
    0,
    outW,
    outH // destination (our export canvas)
  );

  // ---------- Overlays (ScaleBar etc.) ----------
  const SCALEBAR_SELECTORS = [".scale-bar"];
  const selectors = [...SCALEBAR_SELECTORS, ...extraOverlaySelectors];

  // Only overlays inside <main>
  const overlayNodes = selectors.flatMap((sel) =>
    Array.from(mainEl.querySelectorAll(sel))
  );

  for (const el of overlayNodes) {
    await drawDomOverlayToCanvas(ctx, el, mainEl, resolutionScale);
  }

  // ---------- Build PDF ----------
  const mmPerPx = 0.2645833333; // 96dpi assumption
  const imgWmm = outW * mmPerPx;
  const imgHmm = outH * mmPerPx;

  const orientation = imgWmm > imgHmm ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginMm = margin * mmPerPx;

  // Reserve some vertical space for the header if provided
  const headerBlockMm = headerText ? 12 : 0; // total space reserved for text + gap

  const availW = pageW - marginMm * 2;
  const availH = pageH - marginMm * 2 - headerBlockMm;
  const scale = Math.min(availW / imgWmm, availH / imgHmm);

  const drawW = imgWmm * scale;
  const drawH = imgHmm * scale;
  const dx = (pageW - drawW) / 2;
  const dy = marginMm + headerBlockMm; // map starts below header

  const dataUrl = outCanvas.toDataURL("image/png");

  // Optional header text (title/address) – PDF only
  if (headerText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    // Position: inside top margin, centered
    const textY = marginMm + 6; // 6 mm down from top margin
    doc.text(headerText, pageW / 2, textY, { align: "center" });
  }

  doc.addImage(dataUrl, "PNG", dx, dy, drawW, drawH);
  doc.save(filename);
}
