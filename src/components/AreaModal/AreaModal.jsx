// src/components/Tools/DrawArea/AreaModal.jsx
import React from "react";
import { ensureAreaDraftShape } from "../Tools/DrawArea/areaDraft"; // <- uses your helper to normalize draft

export default function AreaModal({
  open,
  draft,
  setDraft,
  onConfirm,
  onClose,
  isCreate = false,
}) {
  if (!open) return null;

  // Normalize for UI (doesn't mutate original until setDraft is called)
  const d = ensureAreaDraftShape(draft);

  const percent = (v) =>
    Math.max(0, Math.min(1, typeof v === "number" ? v : 0.25)) * 100;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
      }}
      onMouseDown={(e) => {
        // click outside dialog closes (optional)
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          maxWidth: 360,
          width: "90vw",
          background: "var(--c-background-modal)",
          color: "var(--c-text-black)",
          borderRadius: 10,
          padding: 24,
          boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: 16,
            fontSize: 16,
            color: "var(--c-text-black)",
            fontWeight: 500,
          }}
        >
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
              type="color"
              value={d.fillHex ?? "#ff3b30"}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, fillHex: e.target.value }))
              }
              style={{
                width: 40,
                height: 40,
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
                value={
                  typeof d.fillOpacity === "number" ? d.fillOpacity : 0.25
                }
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

        {/* Row: Outline color + width */}
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
            <span style={{ fontSize: 12, opacity: 0.8 }}>Kantfärg</span>
            <input
              type="color"
              value={d.outlineColor ?? "#ff3b30"}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, outlineColor: e.target.value }))
              }
              style={{
                width: 40,
                height: 40,
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
            <span style={{ fontSize: 12, opacity: 0.8 }}>Kanttjocklek</span>
            <input
              type="number"
              min={0}
              max={12}
              value={Number.isFinite(d.outlineWidth) ? d.outlineWidth : 2}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  outlineWidth: Number(e.target.value || 2),
                }))
              }
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid #444",
                background: "#fff",
                color: "var(--c-text-black)",
                outlineColor: "var(--blue-700)",
              }}
            />
          </label>
        </div>

        {/* Row: Point color + size */}
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
            <span style={{ fontSize: 12, opacity: 0.8 }}>Punktfärg</span>
            <input
              type="color"
              value={d.pointColor ?? "#0066ff"}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, pointColor: e.target.value }))
              }
              style={{
                width: 40,
                height: 40,
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
            <span style={{ fontSize: 12, opacity: 0.8 }}>Punktstorlek</span>
            <input
              type="number"
              min={4}
              max={24}
              value={Number.isFinite(d.pointSize) ? d.pointSize : 8}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  pointSize: Number(e.target.value || 8),
                }))
              }
              style={{
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid #444",
                background: "#fff",
                color: "var(--c-text-black)",
                outlineColor: "var(--blue-700)",
              }}
            />
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
                setDraft((prev) => ({ ...prev, showEdgeValues: e.target.checked }))
              }
            />
            <span>Visa sidlängder</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={!!d.showPoints}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, showPoints: e.target.checked }))
              }
            />
            <span>Visa punkter</span>
          </label>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
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
    </div>
  );
}
