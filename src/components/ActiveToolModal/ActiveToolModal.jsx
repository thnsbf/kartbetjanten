// src/components/ActiveToolModal/ActiveToolModal.jsx
import React from "react";
import "./ActiveToolModal.css"; // optional; uses your existing modal classes too

export default function ActiveToolModal({
  open,
  activeTool,
  onConfirmExit,
  onCancelExit,
  isMobile,
}) {
  if (!open) return null;

  // Short label for the tool
  const toolName =
    activeTool === "draw-lines"
      ? "Rita linjer"
      : activeTool === "draw-area"
      ? "Rita area"
      : activeTool === "place-dot"
      ? "Placera punkt"
      : activeTool === "place-text"
      ? "Placera text"
      : activeTool === "move-object"
      ? "Flytta objekt"
      : "Verktyg";

  const handleConfirm = () => {
    // For lines / area we signal “finish” to the tool (it will finalize if valid).
    if (activeTool === "draw-lines" || activeTool === "draw-area") {
      window.dispatchEvent(new CustomEvent("kb:finish-active-tool"));
    }
    // For markers and text, “confirm” behaves like cancel (just exit the tool).
    onConfirmExit?.();
  };

  const handleCancel = () => {
    onCancelExit?.();
  };

  return (
    <div
      className="tool-modal"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.stopPropagation()}
      style={{}}
    >
      <h3 className="h3-modal" style={{}}>
        {toolName}
      </h3>

      <p style={{ marginTop: 0, marginBottom: 12, fontSize: 12 }}>
        Ett verktyg är aktivt. Du kan bekräfta eller avbryta.{" "}
        {activeTool === "draw-lines" || activeTool === "draw-area"
          ? `Bekräfta avslutar ritningen med nuvarande bekräftade punkter${
              !isMobile ? " (gummisnodden tas inte med)" : ""
            }.`
          : activeTool === "place-text"
          ? "Klicka i kartan för att välja en position och öppna Text-dialogen."
          : activeTool === "move-object"
          ? "Dra och släpp för att flytta dina objekt i kartan."
          : "Bekräfta eller avbryt för att lämna verktyget."}
      </p>

      <div
        className="modal__btn-container"
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
      >
        <button
          onClick={handleCancel}
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
          onClick={handleConfirm}
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
