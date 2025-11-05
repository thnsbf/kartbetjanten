// src/components/LinesModal/LinesModal.jsx

export default function LinesModal({
  open,
  draft,
  setDraft,
  onConfirm,
  onClose,
  isPlaceLine, // true => "Placera", false => "Redigera"
}) {
  if (!open) return null;

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
        // click outside dialog closes
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          maxWidth: 360,
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
            fontSize: "16px",
            color: "var(--c-text-black)",
            fontWeight: 500,
          }}
        >
          {isPlaceLine ? "Placera linje" : "Redigera linje"}
        </h3>

        {/* Row 1: Line color, Line width, Line type */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 60px 1fr",
            gap: 12,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <label
            className="label-text"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
          >
            <span style={{ fontSize: 12, opacity: 0.8 }}>Linjefärg</span>
            <input
              type="color"
              value={draft.lineColor}
              onChange={(e) => setDraft((d) => ({ ...d, lineColor: e.target.value }))}
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

          <label className="label-text" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 12, opacity: 0.8}}>Linjebredd</div>
            <input
              type="number"
              min={1}
              max={20}
              value={draft.lineWidth}
              onChange={(e) =>
                setDraft((d) => ({ ...d, lineWidth: Number(e.target.value || 1) }))
              }
              style={{
                boxSizing: "border-box",
                width: "52px",
                maxHeight: "32px",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #444",
                background: "#fff",
                color: "var(--c-text-black)",
                outlineColor: "var(--blue-700)",
              }}
            />
          </label>

          <label
            className="label-text"
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}
          >
            <span style={{ fontSize: 12, opacity: 0.8 }}>Linjetyp</span>
            <select
              value={draft.lineType}
              onChange={(e) => setDraft((d) => ({ ...d, lineType: e.target.value }))}
              style={{
                padding: "2px 8px",
                minHeight: "32px",
                borderRadius: 8,
                border: "1px solid #444",
                background: "#fff",
                color: "var(--c-text-black)",
                outlineColor: "var(--blue-700)",
              }}
            >
              <option value="solid">Heldragen</option>
              <option value="dotted">Prickad</option>
            </select>
          </label>
        </div>

        {/* Row 2: Point color, Point size, Show values */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 60px 1fr",
            gap: 12,
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <label
            className="label-text"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
          >
            <span style={{ fontSize: 12, opacity: 0.8}}>Punktfärg</span>
            <input
              type="color"
              value={draft.pointColor}
              onChange={(e) => setDraft((d) => ({ ...d, pointColor: e.target.value }))}
              style={{
                width: 32,
                height: 32,
                padding: 0,
                borderRadius: 8,
                border: "1px solid #444",
                background: "transparent"
              }}
            />
          </label>

          <label className="label-text" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4  }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Punktstorlek</div>
            <input
              type="number"
              min={2}
              max={32}
              value={draft.pointSize}
              onChange={(e) =>
                setDraft((d) => ({ ...d, pointSize: Number(e.target.value || 8) }))
              }
              style={{
                boxSizing: "border-box",
                width: "52px",
                maxHeight: "32px",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #444",
                background: "#fff",
                color: "var(--c-text-black)",
                outlineColor: "var(--blue-700)",
              }}
            />
          </label>

          <label
            className="label-text"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              alignItems: "center",
              justifyContent: "flex-start",
              minWidth: 80,
            }}
            title="Visa längdtext på varje segment"
          >
            <span style={{ fontSize: 12, opacity: 0.8 }}>Visa längdtext</span>
            <input
              type="checkbox"
              checked={!!draft.showValues}
              onChange={(e) => setDraft((d) => ({ ...d, showValues: e.target.checked }))}
              style={{
                width: 18,
                height: 18,
                marginBlock: "6px",
                accentColor: "var(--kommunfarg)",
                cursor: "pointer",
              }}
            />
          </label>
        </div>

        {/* Footer buttons */}
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
            {isPlaceLine ? "Börja rita" : "Bekräfta"}
          </button>
        </div>
      </div>
    </div>
  );
}
