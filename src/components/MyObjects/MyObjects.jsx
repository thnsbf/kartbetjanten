import "./MyObjects.css";
import DownloadButton from "../DownloadButton/DownloadButton";

export default function MyObjects({
  entitiesUpdateUI, // () => void
  entitiesRef, // useRef(Map<uuid, Cesium.Entity>)
  updateShowHideEntitiesRef, // (uuid, showBool) => void
  removeAllInactiveEntitiesRef, // (optional)
  viewer, // ref to Cesium viewer: { current: Viewer | null }
  onEdit, // (uuid) => void
  isMobile,
}) {
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
    // Some labels/points may not have been registered in ent.__children.
    // We also remove any entity whose __parent === ent,
    // or whose id string begins with `${parentId}__`.
    const coll = v?.entities;
    if (!coll) return;
    const list = coll.values ? coll.values.slice() : []; // copy
    const parentId = (ent.id ?? ent._id ?? ent.__uuid ?? "").toString();

    for (const child of list) {
      if (!child) continue;
      if (child.__parent && child.__parent === ent) {
        safeRemove(v, child);
        continue;
      }
      // fallback heuristic: id starts with `${parentId}__`
      const cid = (child.id ?? "").toString?.() ?? "";
      if (parentId && cid && cid.startsWith(parentId + "__")) {
        safeRemove(v, child);
      }
    }
  }

  function removeEntityGroup(v, ent) {
    if (!v || !ent) return;

    // 1) Remove anything we *do* track
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

    // 2) Sweep the scene for any untracked children tied to this parent
    scanAndRemoveSceneChildren(v, ent);

    // 3) Finally remove the parent entity
    safeRemove(v, ent);
  }

  function handleRemove(uuid) {
    updateShowHideEntitiesRef(uuid, false);
  }

  function handleRestore(uuid) {
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

    return (
      <li
        key={id}
        className={
          isActive ? "object-li-item object-li-item--active" : "object-li-item"
        }
      >
        <span className="object-li-item__object-type">{type}</span>
        <span className="object-li-item__date-time">{tsLabel}</span>
        <div className="object-li-item__button-wrapper">
          {isActive ? (
            <>
              <button
                className="object-li-item__button"
                title="Ändra objekt"
                onClick={() => onEdit?.(id)}
              >
                <i>
                  <img
                    className="object-li-item__img"
                    src="/icon-edit--purple.svg"
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
                    src="/icon-trash--purple.svg"
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
                  src="/icon-restore--purple.svg"
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
          {isMobile && <DownloadButton isMobile={true} />}
        </footer>
      </div>
    </section>
  );
}
