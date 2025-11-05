// src/components/MarkerModal/MarkerModal.jsx
import React from "react";

export default function MarkerModal({ open, draft, setDraft, onConfirm, onClose }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)",
        display: "grid", placeItems: "center", zIndex: 1000
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          maxWidth: 320,
          background: "var(--c-background-modal)",
          color: "var(--c-text-black)",
          borderRadius: 10,
          padding: 24,
          boxShadow: "0 8px 30px rgba(0,0,0,0.4)"
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "16px", color: "var(--c-text-black)", fontWeight: 500 }}>
          Redigera punkt
        </h3>

        {/* Row 1: Fill color + Size */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: "52px" }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Punktfärg</span>
            <input
              type="color"
              value={draft.color}
              onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
              style={{ width: 32, height: 32, padding: 0, borderRadius: 8, border: "1px solid #444", background: "transparent" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: "60px" }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Storlek</span>
            <input
              type="number"
              min={2}
              max={64}
              value={draft.size}
              onChange={(e) => {
                const v = Number(e.target.value || 10);
                setDraft((d) => ({ ...d, size: v }));
              }}
              style={{
                padding: "0 4px", borderRadius: 8, border: "1px solid #444",
                background: "#fff", color: "var(--c-text-black)", maxWidth: "40px", height: "32px", textAlign: "center",
                outlineColor: "var(--blue-700)"
              }}
            />
          </label>
        </div>

        {/* Row 2: Border color + Border width */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: "52px" }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Kantfärg</span>
            <input
              type="color"
              value={draft.outlineColor}
              onChange={(e) => setDraft((d) => ({ ...d, outlineColor: e.target.value }))}
              style={{ width: 32, height: 32, padding: 0, borderRadius: 8, border: "1px solid #444", background: "transparent" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: "60px" }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Kantbredd</span>
            <input
              type="number"
              min={0}
              max={10}
              value={draft.outlineWidth}
              onChange={(e) => {
                const v = Number(e.target.value || 0);
                setDraft((d) => ({ ...d, outlineWidth: v }));
              }}
              style={{
                padding: "0 4px", borderRadius: 8, border: "1px solid #444",
                background: "#fff", color: "var(--c-text-black)", maxWidth: "40px", height: "32px", textAlign: "center",
                outlineColor: "var(--blue-700)"
              }}
            />
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: "0.75em 2.5em", borderRadius: "100vmax", border: "none",
              background: "var(--c-danger)", color: "var(--c-text-default)", cursor: "pointer", fontWeight: 600
            }}
          >
            Avbryt
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "0.75em 2.5em", borderRadius: "100vmax", border: "2px solid var(--kommunfarg)",
              background: "var(--c-background-white)", color: "var(--kommunfarg)", cursor: "pointer", fontWeight: 600
            }}
          >
            Bekräfta
          </button>
        </div>
      </div>
    </div>
  );
}
