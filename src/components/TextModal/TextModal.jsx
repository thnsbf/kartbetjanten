import "./TextModal.css"


// Tiny modal component (inline, no portals)
export default function TextModal({ open, draft, setDraft, onConfirm, onClose, isPlaceText }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)",
        display: "grid", placeItems: "center", zIndex: 1000
      }}
      onMouseDown={(e) => {
        // click outside dialog closes (optional)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          maxWidth: 300,
          background: "var(--c-background-modal)",
          color: "var(--c-text-black)",
          borderRadius: 10,
          padding: 24,
          boxShadow: "0 8px 30px rgba(0,0,0,0.4)"
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: "16px", color: "var(--c-text-black)", fontWeight: 500 }}>{ isPlaceText ? "Placera" : "Redigera"} text</h3>

        <label className="label-text" style={{ display: "block", marginBottom: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Text</div>
          <input
            autoFocus
            type="text"
            value={draft.text}
            onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); }}
            style={{
              padding: "8px 10px", borderRadius: 8, border: "1px solid #444",
              background: "#fff", color: "var(--c-text-black)", minWidth: "200px", outlineColor: "var(--blue-700)"
            }}
            placeholder="Skriv din text här…"
          />
        </label>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
          <label className="label-text" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Teckenfärg</span>
            <input
              type="color"
              value={draft.color}
              onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
              style={{ width: 32, height: 32, padding: 0, borderRadius: 8, border: "1px solid #444", background: "transparent", borde: "none" }}
            />
          </label>
          <label className="label-text" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Bakgrundsfärg</span>
            <input
              type="color"
              value={draft.backgroundColor}
              onChange={(e) => setDraft((d) => ({ ...d, backgroundColor: e.target.value }))}
              style={{ width: 32, height: 32, padding: 0, borderRadius: 8, border: "1px solid #444", background: "transparent", borde: "none" }}
            />
          </label>


          <label className="label-text" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.8 }}>Teckenstorlek</span>
            <input
              type="number"
              min={8}
              max={72}
              value={draft.fontSize}
              onChange={(e) => setDraft((d) => ({ ...d, fontSize: Number(e.target.value || 18) }))}
              style={{
                padding: "0 4px", borderRadius: 8, border: "1px solid #444",
                background: "#fff", color: "var(--c-text-black)", maxWidth: "40px", height: "32px", textAlign: "center", outlineColor: "var(--blue-700)"
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
            disabled={!draft.text.trim()}
            style={{
              padding: "0.75em 2.5em", borderRadius: "100vmax", border:  "2px solid var(--kommunfarg)" ,
              background: "var(--c-background-white)",
              color: "var(--kommunfarg)", cursor: draft.text.trim() ? "pointer" : "not-allowed", fontWeight: 600
            }}
          >
            { isPlaceText ? "Lägg till" : "Bekräfta"}
          </button>
        </div>
      </div>
    </div>
  );
}