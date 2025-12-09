import "./MyObjects.css";
import DownloadButton from "../DownloadButton/DownloadButton";
import { useEffect } from "react";

/** Safely request a re-render of the scene */
function requestRender(viewerRef) {
  try {
    viewerRef?.current?.scene?.requestRender?.();
  } catch {}
}

/** Double / restore helpers for different entity kinds */
function hoverAmplifyOn(ent, viewerRef) {
  if (!ent || ent.__hoverBackup) return; // already amplified

  const backup = {};
  const v = viewerRef?.current;

  // --- Punkt (point or billboard)
  if (ent.point && !ent.polyline && !ent.polygon) {
    backup.pointSize = ent.point.pixelSize;
    ent.point.pixelSize = Number(ent.point.pixelSize || 10) * 2;
  }
  if (ent.billboard && !ent.polyline && !ent.polygon) {
    backup.billboard = {
      width: ent.billboard.width,
      height: ent.billboard.height,
    };
    const w = Number(ent.billboard.width || 16);
    const h = Number(ent.billboard.height || 16);
    ent.billboard.width = w * 2;
    ent.billboard.height = h * 2;
  }

  // --- Text (label only)
  if (ent.label && !ent.polyline && !ent.polygon) {
    const curScale =
      typeof ent.label.scale === "number"
        ? ent.label.scale
        : ent.label.scale?.getValue?.() ?? 1;
    backup.labelScale = curScale;
    ent.label.scale = curScale * 2;
  }

  // --- Linje
  if (ent.polyline) {
    // width
    const curW =
      typeof ent.polyline.width === "number"
        ? ent.polyline.width
        : ent.polyline.width?.getValue?.() ?? 3;
    backup.lineWidth = curW;
    ent.polyline.width = Math.max(1, curW * 2);

    // visible junction-points (if any)
    const pts = ent.__children?.points || [];
    if (Array.isArray(pts) && pts.length) {
      backup.linePointSizes = pts.map((p) => p?.point?.pixelSize ?? null);
      pts.forEach((p) => {
        if (p?.point && p.show !== false) {
          const s = Number(p.point.pixelSize || 8);
          p.point.pixelSize = Math.max(1, s * 2);
        }
      });
    }
  }

  // --- Area
  if (ent.polygon) {
    // outline width
    const curOW =
      typeof ent.polygon.outlineWidth === "number"
        ? ent.polygon.outlineWidth
        : ent.polygon.outlineWidth?.getValue?.() ?? 1;
    backup.outlineWidth = curOW;
    ent.polygon.outlineWidth = Math.max(1, curOW * 2);

    // visible junction-points (if any)
    const pts = ent.__children?.points || [];
    if (Array.isArray(pts) && pts.length) {
      backup.areaPointSizes = pts.map((p) => p?.point?.pixelSize ?? null);
      pts.forEach((p) => {
        if (p?.point && p.show !== false) {
          const s = Number(p.point.pixelSize || 8);
          p.point.pixelSize = Math.max(1, s * 2);
        }
      });
    }

    // optional: center label scale
    if (ent.__children?.label) {
      const lbl = ent.__children.label;
      const cur =
        typeof lbl.label.scale === "number"
          ? lbl.label.scale
          : lbl.label.scale?.getValue?.() ?? 1;
      backup.areaLabelScale = cur;
      lbl.label.scale = cur * 2;
    }

    // optional: edge labels scale
    if (Array.isArray(ent.__children?.edgeLabels)) {
      backup.edgeLabelScales = ent.__children.edgeLabels.map((l) => {
        const cur =
          typeof l?.label?.scale === "number"
            ? l.label.scale
            : l?.label?.scale?.getValue?.() ?? 1;
        return cur;
      });
      ent.__children.edgeLabels.forEach((l) => {
        if (l?.label && l.show !== false) {
          const cur =
            typeof l.label.scale === "number"
              ? l.label.scale
              : l.label.scale?.getValue?.() ?? 1;
          l.label.scale = cur * 2;
        }
      });
    }
  }

  ent.__hoverBackup = backup;
  requestRender(v);
}

function hoverAmplifyOff(ent, viewerRef) {
  if (!ent || !ent.__hoverBackup) return;
  const b = ent.__hoverBackup;
  const v = viewerRef?.current;

  // Punkt
  if (b.pointSize != null && ent.point) {
    ent.point.pixelSize = b.pointSize;
  }
  if (b.billboard && ent.billboard) {
    ent.billboard.width = b.billboard.width;
    ent.billboard.height = b.billboard.height;
  }

  // Text
  if (b.labelScale != null && ent.label) {
    ent.label.scale = b.labelScale;
  }

  // Linje
  if (b.lineWidth != null && ent.polyline) {
    ent.polyline.width = b.lineWidth;
  }
  if (Array.isArray(b.linePointSizes) && ent.__children?.points) {
    ent.__children.points.forEach((p, i) => {
      const s = b.linePointSizes[i];
      if (p?.point && s != null) p.point.pixelSize = s;
    });
  }

  // Area
  if (b.outlineWidth != null && ent.polygon) {
    ent.polygon.outlineWidth = b.outlineWidth;
  }
  if (Array.isArray(b.areaPointSizes) && ent.__children?.points) {
    ent.__children.points.forEach((p, i) => {
      const s = b.areaPointSizes[i];
      if (p?.point && s != null) p.point.pixelSize = s;
    });
  }
  if (b.areaLabelScale != null && ent.__children?.label) {
    ent.__children.label.label.scale = b.areaLabelScale;
  }
  if (Array.isArray(b.edgeLabelScales) && ent.__children?.edgeLabels) {
    ent.__children.edgeLabels.forEach((l, i) => {
      const s = b.edgeLabelScales[i];
      if (l?.label && s != null) l.label.scale = s;
    });
  }

  delete ent.__hoverBackup;
  requestRender(v);
}

function restoreAllAmplified(viewerRef, entitiesRef) {
  try {
    for (const ent of entitiesRef.current.values()) {
      if (ent?.__hoverBackup) hoverAmplifyOff(ent, viewerRef);
    }
  } catch {}
}

export default function MyObjects({
  entitiesUpdateUI, // () => void
  entitiesRef, // useRef(Map<uuid, Cesium.Entity>)
  updateShowHideEntitiesRef, // (uuid, showBool) => void
  removeAllInactiveEntitiesRef, // (optional)
  viewer, // ref to Cesium viewer: { current: Viewer | null }
  onEdit, // (uuid) => void
  isMobile,
  onDownloadMap,
  onDownloadJson,
  activeTool, // used to gate hover behavior
}) {
  // --- Cleanup on unmount: ensure nothing remains amplified --------------
  useEffect(() => {
    return () => {
      restoreAllAmplified(viewer, entitiesRef);
    };
  }, [viewer, entitiesRef]);

  // --- Helpers ---------------------------------------------------------------
  function safeRemove(v, e) {
    if (!v || !v.entities || !e) return;
    try {
      if (v.entities.contains(e)) v.entities.remove(e);
    } catch {
      /* ignore */
    }
  }

  function scanAndRemoveSceneChildren(v, ent) {
    const coll = v?.entities;
    if (!coll) return;
    const list = coll.values ? coll.values.slice() : [];
    const parentId = (ent.id ?? ent._id ?? ent.__uuid ?? "").toString();

    for (const child of list) {
      if (!child) continue;
      if (child.__parent && child.__parent === ent) {
        safeRemove(v, child);
        continue;
      }
      const cid = (child.id ?? "").toString?.() ?? "";
      if (parentId && cid && cid.startsWith(parentId + "__")) {
        safeRemove(v, child);
      }
    }
  }

  function removeEntityGroup(v, ent) {
    if (!v || !ent) return;
    const ch = ent.__children || {};

    const arrays = ["labels", "edgeLabels", "points"];
    for (const key of arrays) {
      const arr = ch[key];
      if (Array.isArray(arr)) {
        for (const child of arr) safeRemove(v, child);
        ch[key] = [];
      }
    }

    if (ch.totalLabel) {
      safeRemove(v, ch.totalLabel);
      ch.totalLabel = null;
    }
    if (ch.label) {
      safeRemove(v, ch.label);
      ch.label = null;
    }

    if (ch.temp && typeof ch.temp === "object") {
      if (ch.temp.poly) {
        safeRemove(v, ch.temp.poly);
        ch.temp.poly = null;
      }
      if (ch.temp.label) {
        safeRemove(v, ch.temp.label);
        ch.temp.label = null;
      }
    }

    ent.__children = ch;
    scanAndRemoveSceneChildren(v, ent);
    safeRemove(v, ent);
  }

  function handleRemove(uuid) {
    const ent = entitiesRef.current.get(uuid);
    if (ent) hoverAmplifyOff(ent, viewer); // ensure not enlarged when hiding
    updateShowHideEntitiesRef(uuid, false);
  }

  function handleRestore(uuid) {
    const ent = entitiesRef.current.get(uuid);
    if (ent) hoverAmplifyOff(ent, viewer); // clear any lingering enlargement
    updateShowHideEntitiesRef(uuid, true);
  }

  function handleRemoveInactive() {
    const v = viewer?.current;
    if (!v) return;

    const toDelete = [];
    for (const [uuid, ent] of entitiesRef.current.entries()) {
      if (!ent || ent.isActive) continue;
      removeEntityGroup(v, ent);
      toDelete.push(uuid);
    }
    for (const uuid of toDelete) {
      entitiesRef.current.delete(uuid);
    }
    entitiesUpdateUI?.();
  }

  // --- Render list -----------------------------------------------------------
  const usedObjects = Array.from(entitiesRef.current.values() || []);
  usedObjects.sort(
    (a, b) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );

  const liItems = usedObjects.map((obj) => {
    const id = obj.id ?? obj._id ?? obj.__uuid;
    const isActive = !!obj.isActive;
    const type =
      obj.type ??
      (obj.polyline
        ? "Linje"
        : obj.polygon
        ? "Area"
        : obj.label
        ? "Text"
        : "Punkt");
    const tsLabel = new Date(obj.lastUpdated).toLocaleString("sv-SE", {
      hour12: false,
    });

    // Hover handlers: only when active (visible) and "no-tool"
    const hoverProps =
      isActive && activeTool === "no-tool"
        ? {
            onMouseEnter: () => hoverAmplifyOn(obj, viewer),
            onMouseLeave: () => hoverAmplifyOff(obj, viewer),
          }
        : {};

    // Ensure we shrink immediately when user clicks edit (before switching pane)
    const handleEditClick = () => {
      if (isActive && activeTool === "no-tool") {
        hoverAmplifyOff(obj, viewer);
      }
      onEdit?.(id);
    };

    return (
      <li
        key={id}
        className={
          isActive ? "object-li-item object-li-item--active" : "object-li-item"
        }
        {...hoverProps}
      >
        <span className="object-li-item__object-type">{type}</span>
        <span className="object-li-item__date-time">{tsLabel}</span>
        <div className="object-li-item__button-wrapper">
          {isActive ? (
            <>
              <button
                className="object-li-item__button"
                title="Ändra objekt"
                onClick={handleEditClick}
              >
                <i>
                  <img
                    className="object-li-item__img"
                    src="icon-edit--purple.svg"
                    alt="Ändra"
                  />
                </i>
              </button>
              <button
                onClick={() => handleRemove(id)}
                className="object-li-item__button"
                title="Ta bort objekt"
              >
                <i>
                  <img
                    className="object-li-item__img"
                    src="icon-trash--purple.svg"
                    alt="Ta bort"
                  />
                </i>
              </button>
            </>
          ) : (
            <button
              onClick={() => handleRestore(id)}
              className="object-li-item__button"
              title="Återställ objekt"
            >
              <i>
                <img
                  className="object-li-item__img"
                  src="icon-restore--purple.svg"
                  alt="Återställ"
                />
              </i>
            </button>
          )}
        </div>
      </li>
    );
  });

  const activeLiItems = [];
  const inActiveLiItems = [];
  liItems.forEach((item) => {
    if (item.props.className.includes("--active")) activeLiItems.push(item);
    else inActiveLiItems.push(item);
  });

  return (
    <section id="my-objects" className="my-objects">
      <header className="my-objects__header">
        <h2>Mina objekt</h2>
      </header>

      <div className="my-objects__inner">
        <h3>Aktiva objekt</h3>
        <ul className="my-objects__ul">
          {activeLiItems.length ? activeLiItems : "Inga aktiva objekt"}
        </ul>

        <hr className="my-objects__hr" />

        <h3>Senast borttagna</h3>
        <ul className="my-objects__ul my-objects__ul--last-removed">
          {inActiveLiItems.length ? inActiveLiItems : "Inga borttagna objekt"}
        </ul>

        <hr className="my-objects__hr" />

        <footer className="my-objects__footer">
          <button
            onClick={handleRemoveInactive}
            className="my-objects__btn-clear"
            disabled={inActiveLiItems.length < 1}
          >
            Rensa borttagna
          </button>
          {isMobile && (
            <DownloadButton
              isMobile={true}
              onClickPdf={onDownloadMap}
              onClickJson={onDownloadJson}
            />
          )}
        </footer>
      </div>
    </section>
  );
}
