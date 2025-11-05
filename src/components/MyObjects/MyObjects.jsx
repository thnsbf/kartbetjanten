// src/components/MyObjects/MyObjects.jsx
import "./MyObjects.css";
import { useState } from "react";

import TextModal from "../TextModal/TextModal";
import LinesModal from "../LinesModal/LinesModal";
import AreaModal from "../AreaModal/AreaModal";
import MarkerModal from "../MarkerModal/MarkerModal";

import { draftFromEntityLabel, applyDraftToEntityLabel } from "../Tools/AddText/labelDraft";
import { draftFromLineEntity, applyDraftToLineEntity } from "../Tools/DrawLines/linesDraft";
import {
  draftFromAreaEntity,
  applyDraftToAreaEntity,
} from "../Tools/DrawArea/areaDraft";
import {
  draftFromMarkerEntity,
  applyDraftToMarkerEntity,
} from "../Tools/AddMarker/markersDraft";

export default function MyObjects({
  entitiesUpdateUI,               // () => void
  entitiesRef,                    // useRef(Map<uuid, Cesium.Entity>)
  updateShowHideEntitiesRef,      // (uuid, showBool) => void
  removeAllInactiveEntitiesRef,   // () => void
  viewer,                         // Cesium viewer (needed for applyDraftTo* functions that rebuild labels, etc.)
}) {
  // --- TEXT modal state ---
  const [textOpen, setTextOpen] = useState(false);
  const [editTextUuid, setEditTextUuid] = useState(null);
  const [textDraft, setTextDraft] = useState({
    text: "",
    color: "#ffffff",
    backgroundColor: "#111111",
    fontSize: 20,
  });

  // --- LINES modal state ---
  const [lineOpen, setLineOpen] = useState(false);
  const [editLineUuid, setEditLineUuid] = useState(null);
  const [lineDraft, setLineDraft] = useState({
    lineColor: "#ff3b30",
    lineWidth: 3,
    lineType: "solid",
    pointColor: "#0066ff",
    pointSize: 8,
    showValues: true,
  });

  // --- AREA modal state ---
  const [areaOpen, setAreaOpen] = useState(false);
  const [editAreaUuid, setEditAreaUuid] = useState(null);
  const [areaDraft, setAreaDraft] = useState({
    pointColor: "#0066ff",
    pointSize: 8,
    fillHex: "#ff3b30",
    fillOpacity: 0.25,
    outlineColor: "#ff3b30",
    outlineWidth: 2,
    showAreaLabel: true,
    showPoints: false,
    showEdgeValues: true,
  });

  // --- MARKER modal state ---
  const [markerOpen, setMarkerOpen] = useState(false);
  const [editMarkerUuid, setEditMarkerUuid] = useState(null);
  const [markerDraft, setMarkerDraft] = useState({
    color: "#ff0000",
    pixelSize: 10,
    outlineColor: "#ffffff",
    outlineWidth: 2,
  });

  // Snapshot for rendering
  const usedObjects = Array.from(entitiesRef.current.values() || []);
  usedObjects.sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );

  function handleRemove(uuid) {
    updateShowHideEntitiesRef(uuid, false);
  }
  function handleRestore(uuid) {
    updateShowHideEntitiesRef(uuid, true);
  }
  function handleRemoveInactive() {
    removeAllInactiveEntitiesRef();
  }

  function handleEdit(uuid) {
    const ent = entitiesRef.current.get(uuid);
    if (!ent) return;

    // TEXT
    if (ent.label && !ent.polyline && !ent.polygon) {
      setTextDraft(draftFromEntityLabel(ent));
      setEditTextUuid(uuid);
      setTextOpen(true);
      return;
    }

    // LINE
    if (ent.polyline) {
      setLineDraft(draftFromLineEntity(ent));
      setEditLineUuid(uuid);
      setLineOpen(true);
      return;
    }

    // AREA (polygon)
    if (ent.polygon) {
      setAreaDraft(draftFromAreaEntity(ent));
      setEditAreaUuid(uuid);
      setAreaOpen(true);
      return;
    }

    // MARKER (point)
    if (ent.point) {
      setMarkerDraft(draftFromMarkerEntity(ent));
      setEditMarkerUuid(uuid);
      setMarkerOpen(true);
      return;
    }
  }

  // --- CONFIRM handlers ---
  function confirmTextEdit() {
    const ent = entitiesRef.current.get(editTextUuid);
    if (!ent) {
      setTextOpen(false);
      setEditTextUuid(null);
      return;
    }
    applyDraftToEntityLabel(ent, textDraft);
    ent.lastUpdated = new Date().toISOString();
    ent.isActive = true;
    entitiesUpdateUI?.();
    setTextOpen(false);
    setEditTextUuid(null);
  }

  function confirmLineEdit() {
    const ent = entitiesRef.current.get(editLineUuid);
    if (!ent) {
      setLineOpen(false);
      setEditLineUuid(null);
      return;
    }
    applyDraftToLineEntity(ent, lineDraft, viewer);
    ent.lastUpdated = new Date().toISOString();
    ent.isActive = true;
    entitiesUpdateUI?.();
    setLineOpen(false);
    setEditLineUuid(null);
  }

  function confirmAreaEdit() {
    const ent = entitiesRef.current.get(editAreaUuid);
    if (!ent) {
      setAreaOpen(false);
      setEditAreaUuid(null);
      return;
    }
    applyDraftToAreaEntity(ent, areaDraft, viewer);
    ent.lastUpdated = new Date().toISOString();
    ent.isActive = true;
    entitiesUpdateUI?.();
    setAreaOpen(false);
    setEditAreaUuid(null);
  }

  function confirmMarkerEdit() {
    const ent = entitiesRef.current.get(editMarkerUuid);
    if (!ent) {
      setMarkerOpen(false);
      setEditMarkerUuid(null);
      return;
    }
    applyDraftToMarkerEntity(ent, markerDraft);
    ent.lastUpdated = new Date().toISOString();
    ent.isActive = true;
    entitiesUpdateUI?.();
    setMarkerOpen(false);
    setEditMarkerUuid(null);
  }

  const liItems = usedObjects.map((obj) => {
    const { type, lastUpdated, isActive, id } = obj;
    const tsLabel = new Date(lastUpdated).toLocaleString("sv-SE", { hour12: false });

    return (
      <li
        key={id}
        className={isActive ? "object-li-item object-li-item--active" : "object-li-item"}
      >
        <span className="object-li-item__object-type">{type}</span>
        <span className="object-li-item__date-time">{tsLabel}</span>
        <div className="object-li-item__button-wrapper">
          {isActive ? (
            <>
              <button
                className="object-li-item__button"
                title="Ändra objekt"
                onClick={() => handleEdit(id)}
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
    <aside id="my-objects" className="my-objects">
      <header className="my-objects__header">
        <h2>Mina objekt</h2>
      </header>

      <div className="my-objects__inner">
        <h3>Aktiva objekt</h3>
        <ul className="my-objects__ul">
          {activeLiItems.length ? activeLiItems : "Inga aktiva objekt"}
        </ul>

        <hr />

        <h3>Senast borttagna</h3>
        <ul className="my-objects__ul">
          {inActiveLiItems.length ? inActiveLiItems : "Inga borttagna objekt"}
        </ul>

        <hr />

        <footer className="my-objects__footer">
          <button
            onClick={handleRemoveInactive}
            className="my-objects__btn-clear"
            disabled={inActiveLiItems.length < 1}
          >
            Rensa borttagna
          </button>
        </footer>
      </div>

      {/* TEXT modal */}
      <TextModal
        open={textOpen}
        draft={textDraft}
        setDraft={setTextDraft}
        onConfirm={confirmTextEdit}
        onClose={() => {
          setTextOpen(false);
          setEditTextUuid(null);
        }}
        isPlaceText={false}
      />

      {/* LINES modal */}
      <LinesModal
        open={lineOpen}
        draft={lineDraft}
        setDraft={setLineDraft}
        onConfirm={confirmLineEdit}
        onClose={() => {
          setLineOpen(false);
          setEditLineUuid(null);
        }}
        isCreate={false}
      />

      {/* AREA modal */}
      <AreaModal
        open={areaOpen}
        draft={areaDraft}
        setDraft={setAreaDraft}
        onConfirm={confirmAreaEdit}
        onClose={() => {
          setAreaOpen(false);
          setEditAreaUuid(null);
        }}
        isCreate={false}
      />

      {/* MARKER modal */}
      <MarkerModal
        open={markerOpen}
        draft={markerDraft}
        setDraft={setMarkerDraft}
        onConfirm={confirmMarkerEdit}
        onClose={() => {
          setMarkerOpen(false);
          setEditMarkerUuid(null);
        }}
        isCreate={false}
      />
    </aside>
  );
}
