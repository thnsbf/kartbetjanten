// src/components/MarkerModal/MarkerModal.jsx
import React from "react";

const ICON_OPTIONS = [
  { value: "dot", label: "Punkt" },
  { value: "pin", label: "Kartnål" },
  { value: "flag", label: "Flagga" },
  { value: "star", label: "Stjärna" },
  { value: "toilet", label: "Toalett" },
  { value: "outlet", label: "Eluttag" },
  { value: "borehole", label: "Borrhål" },
  { value: "water", label: "Dricksvatten" },
  { value: "sewage", label: "Avloppsanläggning" },
];

export default function MarkerModal({
  open,
  draft,
  setDraft,
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  const isDot = (draft.iconId || "dot") === "dot";

  return (
    <div
      className="tool-modal"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.stopPropagation()}
      style={{}}
    >
      <h3 className="h3-modal" style={{}}>
        Redigera punkt
      </h3>

      {/* Row 0: Icon select */}
      <div className="modal-row" style={{ marginBottom: 6 }}>
        <label
          className="label-text"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            minWidth: 140,
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>Ikon</span>
          <select
            className="modal-input"
            value={draft.iconId || "dot"}
            onChange={(e) =>
              setDraft((d) => ({ ...d, iconId: e.target.value }))
            }
            style={{
              padding: "6px 8px",
              minHeight: 32,
              borderRadius: 8,
              border: "1px solid #444",
              background: "#fff",
              color: "var(--c-text-black)",
              outlineColor: "var(--blue-700)",
            }}
          >
            {ICON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 1: Fill color + Size */}
      <div className="modal-row">
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            minWidth: "52px",
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>
            {isDot ? "Punktfärg" : "Ikonfärg"}
          </span>
          <input
            type="color"
            value={draft.color}
            onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
            className="modal-input"
            style={{
              width: 32,
              height: 32,
              padding: 0,
              borderRadius: 8,
              border: "1px solid #444",
              background: "transparent",
            }}
          />
        </label>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            minWidth: "60px",
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>Storlek</span>
          <input
            className="modal-input modal-input__number"
            type="number"
            min={8}
            max={128}
            value={draft.size}
            onChange={(e) => {
              const v = Number(e.target.value || 16);
              setDraft((d) => ({ ...d, size: v }));
            }}
            style={{
              borderRadius: 8,
              border: "1px solid #444",
              background: "#fff",
              color: "var(--c-text-black)",
              maxWidth: "56px",
              height: "32px",
              textAlign: "center",
              outlineColor: "var(--blue-700)",
            }}
          />
        </label>
      </div>

      {/* Row 2: Border color + width (only for dot) */}
      <div
        className="modal-row"
        style={{
          opacity: isDot ? 1 : 0.5,
          pointerEvents: isDot ? "auto" : "none",
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            minWidth: "52px",
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>Kantfärg</span>
          <input
            type="color"
            value={draft.outlineColor}
            onChange={(e) =>
              setDraft((d) => ({ ...d, outlineColor: e.target.value }))
            }
            style={{
              width: 32,
              height: 32,
              padding: 0,
              borderRadius: 8,
              border: "1px solid #444",
              background: "transparent",
            }}
          />
        </label>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            minWidth: "60px",
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>Kantbredd</span>
          <input
            type="number"
            className="modal-input modal-input__number"
            min={0}
            max={10}
            value={draft.outlineWidth}
            onChange={(e) => {
              const v = Number(e.target.value || 0);
              setDraft((d) => ({ ...d, outlineWidth: v }));
            }}
            style={{
              borderRadius: 8,
              border: "1px solid #444",
              background: "#fff",
              color: "var(--c-text-black)",
              maxWidth: "56px",
              height: "32px",
              textAlign: "center",
              outlineColor: "var(--blue-700)",
            }}
          />
        </label>
      </div>

      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
        className="modal__btn-container"
      >
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
          Bekräfta
        </button>
      </div>
    </div>
  );
}
