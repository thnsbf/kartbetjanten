// src/components/Tools/DrawArea/AreaModal.jsx
import React from "react";
import { ensureAreaDraftShape } from "../Tools/DrawArea/areaDraft"; // <- uses your helper to normalize draft

export default function AreaModal({
  open,
  draft,
  setDraft,
  onConfirm,
  onClose,
  onContinueDraw, // <-- NEW: optional callback to enter "continue drawing" mode
  isCreate = false,
}) {
  if (!open) return null;

  // Normalize for UI (doesn't mutate original until setDraft is called)
  const d = ensureAreaDraftShape(draft);

  const percent = (v) =>
    Math.max(0, Math.min(1, typeof v === "number" ? v : 0.25)) * 100;

  const handleContinueDraw = () => {
    onContinueDraw?.();
  };

  return (
    <div
      className="tool-modal"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        background: "var(--c-background-modal)",
        color: "var(--c-text-black)",
        borderRadius: 10,
        padding: 24,
      }}
    >
      <h3 className="h3-modal" style={{}}>
        {isCreate ? "Skapa area" : "Redigera area"}
      </h3>

      {/* Row: Fill color + Opacity */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <label
          className="label-text"
          style={{ display: "flex", flexDirection: "column", gap: 6 }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>Fyllningsfärg</span>
          <input
            className="modal-input modal-input__color"
            type="color"
            value={d.fillHex ?? "#ff3b30"}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, fillHex: e.target.value }))
            }
            style={{
              padding: 0,
              borderRadius: 8,
              border: "1px solid #444",
              background: "transparent",
            }}
          />
        </label>

        <label
          className="label-text"
          style={{ display: "flex", flexDirection: "column", gap: 6 }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>Opacitet</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={typeof d.fillOpacity === "number" ? d.fillOpacity : 0.25}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  fillOpacity: Number(e.target.value),
                }))
              }
              style={{ width: "100%" }}
            />
            <span style={{ minWidth: 42, textAlign: "right" }}>
              {Math.round(percent(d.fillOpacity))}%
            </span>
          </div>
        </label>
      </div>

      {/* Toggles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={!!d.showAreaLabel}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, showAreaLabel: e.target.checked }))
            }
          />
          <span>Visa m²-etikett i centrum</span>
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={!!d.showEdgeValues}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                showEdgeValues: e.target.checked,
              }))
            }
          />
          <span>Visa sidlängder</span>
        </label>
      </div>

      {/* Footer */}
      <div
        className="modal__btn-container"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        {/* Only show "Continue drawing" when editing an existing area */}
        {!isCreate && (
          <button
            type="button"
            onClick={handleContinueDraw}
            style={{
              padding: "0.7em 2.5em",
              borderRadius: "100vmax",
              border: "2px solid var(--kommunfarg)",
              background: "var(--c-background-white)",
              color: "var(--kommunfarg)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Fortsätt rita
          </button>
        )}

        <button
          onClick={onClose}
          style={{
            padding: "0.75em 2.5em",
            borderRadius: "100vmax",
            border: "none",
            background: "var(--c-danger)",
            color: "var(--c-text-default)",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Avbryt
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: "0.75em 2.5em",
            borderRadius: "100vmax",
            border: "2px solid var(--kommunfarg)",
            background: "var(--c-background-white)",
            color: "var(--kommunfarg)",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {isCreate ? "Lägg till" : "Bekräfta"}
        </button>
      </div>
    </div>
  );
}
