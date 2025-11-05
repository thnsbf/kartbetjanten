import { useEffect, useState } from "react";
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Color,
  Cartesian2,
  LabelStyle,
} from "cesium";
import { v4 as uuidv4 } from "uuid";
import TextModal from "../../TextModal/TextModal";
import { applyDraftToEntityLabel, draftFromEntityLabel } from "./labelDraft";



export default function AddText({ viewer, active, onPlaced, onCancel, setEntitiesRef, entitiesUpdateUI }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPos, setPendingPos] = useState(null); // Cartesian3 to place label
  const [draft, setDraft] = useState({
    text: "",
    color: "#ffffff",
    backgroundColor: "#111111",
    fontSize: 20,
    outlineWidth: 0
  });

  useEffect(() => {
    if (!viewer || !active) return;

    const canvas = viewer.scene.canvas;
    const handler = new ScreenSpaceEventHandler(canvas);
    const prevCursor = canvas.style.cursor;
    canvas.style.cursor = "text";

    handler.setInputAction((e) => {
      if (modalOpen) return; // ignore extra clicks while modal is open
      const p = viewer.camera.pickEllipsoid(e.position, viewer.scene.globe.ellipsoid);
      if (!p) return;
      setPendingPos(p);
      setDraft((d) => ({ ...d })); // keep current inputs if user re-tries
      setModalOpen(true);
    }, ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => onCancel?.(), ScreenSpaceEventType.RIGHT_CLICK);

    const onKey = (ev) => { if (ev.key === "Escape") {
      // if modal open, close modal; else cancel tool
      if (modalOpen) setModalOpen(false);
      else onCancel?.();
    }}; 
    window.addEventListener("keydown", onKey);

    return () => {
      handler.destroy();
      window.removeEventListener("keydown", onKey);
      canvas.style.cursor = prevCursor || "default";
    };
  }, [viewer, active, modalOpen, onCancel]);

  // Confirm from modal → create entity
  const confirm = () => {
    if (!viewer || !pendingPos || !draft.text.trim()) { setModalOpen(false); return; }

    const uuid = uuidv4();
    const entity = viewer.entities.add({ id: uuid, position: pendingPos });

    // label graphics
    applyDraftToEntityLabel(entity, draft);

    // metadata for list
    entity.type = "Text";
    entity.isActive = true;
    entity.lastUpdated = new Date().toISOString();
    entity.outlineWidth = false

    // push to entitiesRef and refresh UI
    setEntitiesRef?.(uuid, entity);
    entitiesUpdateUI?.();

    setModalOpen(false);
    setPendingPos(null);
    onPlaced?.(); // auto-exit tool; remove if you want multi-place
  };

  const closeModal = () => {
    setModalOpen(false);
    setPendingPos(null);
    // do NOT cancel the tool automatically; user can click a new spot
    // If you prefer to exit the tool on cancel:
    // onCancel?.();
  };

  return (
    <>
      <TextModal
        open={modalOpen}
        draft={draft}
        setDraft={setDraft}
        onConfirm={confirm}
        onClose={closeModal}        
        isPlaceText={true}
      />
      {/* no visual output otherwise */}
    </>
  );
}
