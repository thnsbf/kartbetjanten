// src/components/TextModal/TextModal.jsx
import "./TextModal.css";

export default function TextModal({
  open,
  draft,
  setDraft,
  onConfirm,
  onClose,
  isPlaceText,
}) {
  if (!open) return null;

  const noBg = draft.backgroundEnabled === false; // checked => no background

  return (
    <div
      className="tool-modal"
      role="dialog"
      aria-modal="true"
      style={{}}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <h3 className="h3-modal" style={{}}>
        {isPlaceText ? "Placera text" : "Redigera text"}
      </h3>

      <label style={{ display: "block", marginBottom: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Text</div>
        <input
          autoFocus
          type="text"
          value={draft.text}
          onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.text?.trim()) onConfirm();
          }}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #444",
            background: "#fff",
            color: "var(--c-text-black)",
            minWidth: 200,
            outlineColor: "var(--blue-700)",
          }}
          placeholder="Skriv din text här…"
        />
      </label>

      <div className="modal-row">
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>Teckenfärg</span>
          <input
            className="modal-input modal-input__color"
            type="color"
            value={draft.color}
            onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
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
            gap: 8,
            opacity: noBg ? 0.5 : 1,
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>Bakgrundsfärg</span>
          <input
            className="modal-input modal-input__color"
            type="color"
            value={draft.backgroundColor}
            disabled={noBg}
            onChange={(e) =>
              setDraft((d) => ({ ...d, backgroundColor: e.target.value }))
            }
            style={{
              width: 32,
              height: 32,
              padding: 0,
              borderRadius: 8,
              border: "1px solid #444",
              background: "transparent",
              cursor: noBg ? "not-allowed" : "pointer",
            }}
          />
        </label>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>Teckenstorlek</span>
          <input
            className="modal-input modal-input__number"
            type="number"
            min={8}
            max={72}
            value={draft.fontSize}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                fontSize: Number(e.target.value || 18),
              }))
            }
            style={{
              padding: "0 4px",
              borderRadius: 8,
              border: "1px solid #444",
              background: "#fff",
              color: "var(--c-text-black)",
              maxWidth: 56,
              height: 32,
              textAlign: "center",
              outlineColor: "var(--blue-700)",
            }}
          />
        </label>
      </div>

      {/* Ingen bakgrundsfärg */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={noBg}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              backgroundEnabled: !e.target.checked, // checked => no bg
            }))
          }
        />
        <span style={{ fontSize: 14 }}>Ingen bakgrundsfärg</span>
      </label>

      <div
        className="modal__btn-container"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 10,
        }}
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
          disabled={!draft.text?.trim()}
          style={{
            padding: "0.75em 2.5em",
            borderRadius: "100vmax",
            border: "2px solid var(--kommunfarg)",
            background: "var(--c-background-white)",
            color: "var(--kommunfarg)",
            cursor: draft.text?.trim() ? "pointer" : "not-allowed",
            fontWeight: 600,
          }}
        >
          {isPlaceText ? "Lägg till" : "Bekräfta"}
        </button>
      </div>
    </div>
  );
}
