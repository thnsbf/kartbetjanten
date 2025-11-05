// src/components/Tools/DrawArea/DrawArea.jsx
import { useEffect, useRef } from "react";
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Color,
  Cartesian2,
  Cartesian3,
  PolygonHierarchy,
  CallbackProperty,
  SceneTransforms,
} from "cesium";
import { v4 as uuidv4 } from "uuid";

import {
  defaultAreaDraft,
  pointGraphicsFromDraft,
  polygonAreaMeters2,
  polygonCentroid,
  formatSquareMeters,
  rebuildAreaEdgeLabels,
  cesiumFillFromDraft,
  ensureAreaDraftShape     
} from "./areaDraft";

// Simple hit-test against the first point in screen space
function firstPointHitTest(scene, firstCartesian, mousePosPx, radiusPx = 14) {
  if (!scene || !firstCartesian || !mousePosPx) return { hit: false, win: null };
  const win = SceneTransforms.worldToWindowCoordinates(scene, firstCartesian, new Cartesian2());
  if (!win || !Number.isFinite(win.x) || !Number.isFinite(win.y)) return { hit: false, win: null };
  const dx = mousePosPx.x - win.x;
  const dy = mousePosPx.y - win.y;
  return { hit: (dx * dx + dy * dy) <= (radiusPx * radiusPx), win };
}

function almostSamePoint(a, b, eps = 0.01) {
  if (!a || !b) return false;
  return Cartesian3.distance(a, b) <= eps;
}


export default function DrawArea({
  viewer,
  active,
  onCancel,           // () => setActiveTool("no-tool")
  setEntitiesRef,     // (uuid, ent) => void
  entitiesUpdateUI,   // () => void
}) {
  const handlerRef = useRef(null);

  // Drawing state
  const draftRef = useRef(ensureAreaDraftShape({ ...defaultAreaDraft }));  const positionsRef = useRef([]);            // committed vertices (Cartesian3[])
  const pointEntsRef = useRef([]);            // committed point marker entities
  const mouseCartesianRef = useRef(null);     // current mouse cartesian (rubber)

  // Temps
  const tempLineRef = useRef(null);           // rubber-band polyline (for 1 point)
  const tempPolyRef = useRef(null);           // rubber-band polygon (for >=2 points)
  const tempLabelRef = useRef(null);          // temporary area label (for >=2 points)
  const firstPointEntityRef = useRef(null);   // first marker entity (enlarge on hover)
  const hoverOverFirstRef = useRef(false);

  // NEW: hover hint label on first point
  const firstHintLabelRef = useRef(null);

  // Dynamic positions for the temp line: [firstPoint, mouse] or []
  const tempLinePositions = new CallbackProperty(() => {
    const pts = positionsRef.current || [];
    const m = mouseCartesianRef.current;
    if (pts.length === 1 && m) {
      return [pts[0], m];
    }
    return []; // never undefined
  }, false);

  // Dynamic hierarchy for the temp polygon: ALWAYS return PolygonHierarchy
  const tempPolyHierarchy = new CallbackProperty(() => {
    const pts = positionsRef.current || [];
    const m = mouseCartesianRef.current;
    if (pts.length >= 2 && m) {
      return new PolygonHierarchy([...pts, m]);
    }
    return new PolygonHierarchy([]);
  }, false);

  // --- Helpers: create/remove temps ---
  function removeTempLine(v) {
    if (tempLineRef.current) {
      v.entities.remove(tempLineRef.current);
      tempLineRef.current = null;
    }
  }
  function ensureTempLine(v) {
    if (!tempLineRef.current) {
      tempLineRef.current = v.entities.add({
        polyline: {
          positions: tempLinePositions,
          width: 2,
          material: Color.RED,
        },
        show: true,
      });
    }
  }

  function removeTempPoly(v) {
    if (tempPolyRef.current) {
      v.entities.remove(tempPolyRef.current);
      tempPolyRef.current = null;
    }
  }
  
function ensureTempPoly(v, draft) {
  if (!tempPolyRef.current) {
    const safe = ensureAreaDraftShape(draft || draftRef.current);
    tempPolyRef.current = v.entities.add({
      polygon: {
        hierarchy: tempPolyHierarchy,
        material: cesiumFillFromDraft(safe),                          // <-- use hex+opacity
        outline: true,
        outlineColor: Color.fromCssColorString(safe.outlineColor),    // <-- from safe draft
        outlineWidth: safe.outlineWidth,                              // <-- from safe draft
      },
      show: false, // toggled by refreshRubber
    });
  }
}


  function upsertTempAreaLabel(v) {
    const pts = positionsRef.current;
    const m = mouseCartesianRef.current;
    const valid = Array.isArray(pts) && pts.length >= 2 && !!m;

    if (!valid) {
      if (tempLabelRef.current) {
        v.entities.remove(tempLabelRef.current);
        tempLabelRef.current = null;
      }
      return;
    }

    const ring = [...pts, m];
    const center = polygonCentroid(ring, v.scene.globe.ellipsoid);
    const area = polygonAreaMeters2(ring, v.scene.globe.ellipsoid);

    if (!tempLabelRef.current) {
      tempLabelRef.current = v.entities.add({
        position: center,
        label: {
          text: formatSquareMeters(area),
          font: "14px Barlow",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
          pixelOffset: new Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        show: true,
      });
    } else {
      tempLabelRef.current.position = center;
      tempLabelRef.current.label.text = formatSquareMeters(area);
      tempLabelRef.current.show = true;
    }
  }

  function clearTemps(v) {
    removeTempLine(v);
    removeTempPoly(v);
    if (tempLabelRef.current) {
      v.entities.remove(tempLabelRef.current);
      tempLabelRef.current = null;
    }
    removeFirstHintLabel(v);
  }

  function resetFirstMarkerSize() {
    const ent = firstPointEntityRef.current;
    if (ent) ent.point.pixelSize = draftRef.current?.pointSize ?? 8;
  }

  function cleanupPointsIfCancelled(v) {
    for (const p of pointEntsRef.current) v.entities.remove(p);
    pointEntsRef.current = [];
    firstPointEntityRef.current = null;
  }

  // Switch between temp line (1 pt) and temp polygon (2+ pts) safely
  function refreshRubber(v) {
    const pts = positionsRef.current || [];
    const m = mouseCartesianRef.current;

    // LINE when exactly 1 committed point and mouse is present
    if (pts.length === 1 && m) {
      ensureTempLine(v);
      tempLineRef.current.show = true;
    } else if (tempLineRef.current) {
      tempLineRef.current.show = false;
    }

    // POLYGON when ≥2 committed points and mouse is present
    const polygonValid = pts.length >= 2 && !!m;
    if (polygonValid) {
      ensureTempPoly(v, draftRef.current);
      tempPolyRef.current.show = true;
    } else if (tempPolyRef.current) {
      tempPolyRef.current.show = false;
    }

    // Temp area label only when polygon is valid
    if (polygonValid) {
      upsertTempAreaLabel(v);
    } else if (tempLabelRef.current) {
      v.entities.remove(tempLabelRef.current);
      tempLabelRef.current = null;
    }
  }

  // --- NEW: first point hover hint label ---
  function upsertFirstHintLabel(v, text) {
    const pts = positionsRef.current;
    if (!pts || pts.length === 0) {
      removeFirstHintLabel(v);
      return;
    }
    const pos = pts[0];
    if (!firstHintLabelRef.current) {
      firstHintLabelRef.current = v.entities.add({
        position: pos,
        label: {
          text,
          font: "13px Barlow",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Color.fromAlpha(Color.BLACK, 0.65),
          pixelOffset: new Cartesian2(0, -18), // slightly above the marker
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        show: true,
      });
    } else {
      firstHintLabelRef.current.position = pos;
      firstHintLabelRef.current.label.text = text;
      firstHintLabelRef.current.show = true;
    }
  }
  function removeFirstHintLabel(v) {
    if (firstHintLabelRef.current) {
      v.entities.remove(firstHintLabelRef.current);
      firstHintLabelRef.current = null;
    }
  }

  // --- NEW: unified cursor updater ---
function updateCursor(v) {
  const canvas = v?.scene?.canvas;
  if (!canvas) return;

  const pts = positionsRef.current || [];

  if (hoverOverFirstRef.current) {
    // When hovering the first point: pointer if closable, else not-allowed
    canvas.style.cursor = pts.length >= 3 ? "pointer" : "not-allowed";
    return;
  }

  // While the tool is active we want a crosshair even before the first click
  canvas.style.cursor = "crosshair";
}


  function finishArea() {
    const v = viewer;
    if (!v) return;
    const pts = positionsRef.current;
    if (!Array.isArray(pts) || pts.length < 3) return;

    // Clean up temps & cursor
    clearTemps(v);
    resetFirstMarkerSize();

    const d = draftRef.current;
    const uuid = uuidv4();

    // Final polygon entity
    const ent = v.entities.add({
      id: uuid,
      polygon: {
        hierarchy: new PolygonHierarchy(pts.slice()), 
        material: cesiumFillFromDraft(d),
        outline: true,
        outlineColor: Color.fromCssColorString(d.outlineColor),
        outlineWidth: d.outlineWidth,
      },
      show: true,
    });

    ent.type = "Area";
    ent.isActive = true;
    ent.lastUpdated = new Date().toISOString();
    ent.__draft = { ...d };
    ent.__children = {
      points: pointEntsRef.current.slice(), // we’ll control visibility below
      edgeLabels: [],
      label: null,
      temp: { poly: null, label: null },
    };

    // Hide points by default (per your requirement)
    for (const p of ent.__children.points) p.show = !!d.showPoints;

    // Center label if enabled
    if (d.showAreaLabel) {
      const center = polygonCentroid(pts, v.scene.globe.ellipsoid);
      const area = polygonAreaMeters2(pts, v.scene.globe.ellipsoid);
      const centerLabel = v.entities.add({
        position: center,
        label: {
          text: formatSquareMeters(area),
          font: "14px Barlow",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Color.fromAlpha(Color.BLACK, 0.6),
          pixelOffset: new Cartesian2(0, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        show: true,
      });
      centerLabel.__parent = ent;
      ent.__children.label = centerLabel;
    }

    // Edge-length labels if enabled
    if (d.showEdgeValues) rebuildAreaEdgeLabels(ent, v);

    // Register & refresh UI
    setEntitiesRef?.(uuid, ent);
    entitiesUpdateUI?.();

    // Reset tool state and exit
    positionsRef.current = [];
    pointEntsRef.current = [];
    firstPointEntityRef.current = null;
    mouseCartesianRef.current = null;
    removeFirstHintLabel(v);

    // Leave the drawing mode: default cursor
    v.scene.canvas.style.cursor = "default";
    onCancel?.();
  }

  useEffect(() => {
    if (!viewer || !active) return;

    const v = viewer;
    const canvas = v.scene.canvas;
    canvas.style.cursor = "crosshair";

    const handler = new ScreenSpaceEventHandler(canvas);
    handlerRef.current = handler;

    // Disable Cesium's default dblclick zoom
    v.screenSpaceEventHandler?.removeInputAction?.(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // LEFT_CLICK: add vertex or finish if over first (and we have ≥3 points)
    handler.setInputAction((e) => {
      const p = v.camera.pickEllipsoid(e.position, v.scene.globe.ellipsoid);
      if (!p) return;

      const pts = positionsRef.current;

      // Finish by clicking first point
      if (hoverOverFirstRef.current && pts.length >= 3) {
        finishArea();
        return;
      }

      // Commit new point
      pts.push(p);
      positionsRef.current = pts;

      // Add visual marker
      if (pts.length === 1) {
        const g = pointGraphicsFromDraft(draftRef.current);
        const fp = v.entities.add({ position: p, point: g, show: true });
        firstPointEntityRef.current = fp;
        pointEntsRef.current.push(fp);
      } else {
        pointEntsRef.current.push(
          v.entities.add({
            position: p,
            point: pointGraphicsFromDraft(draftRef.current),
            show: true,
          })
        );
      }

      // Refresh rubber after click
      refreshRubber(v);
      // Not hovering after click → remove hint, update cursor
      removeFirstHintLabel(v);
      updateCursor(v);
    }, ScreenSpaceEventType.LEFT_CLICK);

    // LEFT_DOUBLE_CLICK: finish polygon (if we have ≥3 points)
       handler.setInputAction(() => {
     const pts = positionsRef.current || [];
     if (pts.length < 3) return;

     // Deduplicate double-click's extra vertex (same spot as previous)
     if (pts.length >= 2 && almostSamePoint(pts[pts.length - 1], pts[pts.length - 2])) {
       // Remove the duplicate cartesian
       pts.pop();
       positionsRef.current = pts;
       // Remove its visual point entity too
       const lastPointEnt = pointEntsRef.current.pop();
       if (lastPointEnt && viewer) viewer.entities.remove(lastPointEnt);
    }

     finishArea();
   }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // RIGHT_CLICK: undo last vertex or cancel if none
    handler.setInputAction(() => {
      const pts = positionsRef.current;
      if (!pts.length) {
        clearTemps(v);
        cleanupPointsIfCancelled(v);
        canvas.style.cursor = "default";
        onCancel?.();
        return;
      }

      // pop last vertex + entity
      pts.pop();
      positionsRef.current = pts;
      const lastEnt = pointEntsRef.current.pop();
      if (lastEnt) v.entities.remove(lastEnt);

      // reset enlarged first size if we’re down to 0–1 point
      if (firstPointEntityRef.current && pts.length <= 1) {
        resetFirstMarkerSize();
      }

      // refresh rubber after undo, and re-evaluate hover hint/cursor
      refreshRubber(v);
      removeFirstHintLabel(v);
      updateCursor(v);
    }, ScreenSpaceEventType.RIGHT_CLICK);

    // MOUSE_MOVE: update mouse cartesian, rubber visuals, hover-first indication
    handler.setInputAction((movement) => {
      const m = v.camera.pickEllipsoid(movement.endPosition, v.scene.globe.ellipsoid);
      mouseCartesianRef.current = m || null;

      // refresh rubber (switch line↔polygon) + temp label
      refreshRubber(v);

      // hover-first detection
      const pts = positionsRef.current;
      const first = pts && pts[0];
      if (first) {
        const { hit } = firstPointHitTest(
          v.scene,
          first,
          new Cartesian2(movement.endPosition.x, movement.endPosition.y),
          14
        );
        const prev = hoverOverFirstRef.current;
        hoverOverFirstRef.current = !!hit;

        if (firstPointEntityRef.current) {
          // Enlarge only if ≥3 points; otherwise keep default size
          const baseSize = draftRef.current?.pointSize ?? 8;
          const enlarged = Math.max(baseSize + 4, 12);
          firstPointEntityRef.current.point.pixelSize =
            hit && pts.length >= 3 ? enlarged : baseSize;
        }

        // Update/show hint label if hovering; remove if not
        if (hoverOverFirstRef.current) {
          const text =
            pts.length >= 3 ? "Finish area" : "A polygon needs at least 3 points";
          upsertFirstHintLabel(v, text);
        } else {
          removeFirstHintLabel(v);
        }
      } else {
        // No first point yet
        removeFirstHintLabel(v);
      }

      // NEW: update cursor based on hover + count
      updateCursor(v);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // ESC to cancel drawing entirely
    const onKey = (ev) => {
      if (ev.key === "Escape") {
        clearTemps(v);
        cleanupPointsIfCancelled(v);
        canvas.style.cursor = "default";
        onCancel?.();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      clearTemps(v);
      cleanupPointsIfCancelled(v);
      resetFirstMarkerSize();
      removeFirstHintLabel(v);
      canvas.style.cursor = "default";
      handlerRef.current?.destroy?.();
      handlerRef.current = null;
      hoverOverFirstRef.current = false;
    };
  }, [viewer, active, onCancel, setEntitiesRef, entitiesUpdateUI]);

  return null;
}
