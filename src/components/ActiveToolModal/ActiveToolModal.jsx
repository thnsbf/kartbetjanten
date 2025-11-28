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
        Ett verktyg är aktivt. Du kan bekräfta eller avbryta. <br />
        {!isMobile
          ? "Du kan när som helst lämna verktyget genom att högerklicka eller trycka på ESC-knappen på ditt tangentbord."
          : 'Du kan när som helst lämna verktyget genom att trycka på "Avbryt"'}
        <br />
        {!isMobile && <br />}
        {activeTool === "draw-lines" ? (
          <span className="text--bold">
            Klicka i kartan för att sätta ut linjepunkter.{" "}
            {!isMobile
              ? 'Högerklicka för att ångra senaste punkten. Dubbelklicka eller klicka på "Bekräfta" för att fastställa linjen (gummisnodden tas inte med)'
              : 'Tryck på "Bekräfta" för att fastställa linjen.'}
            .
          </span>
        ) : activeTool === "draw-area" ? (
          <span className="text--bold">
            Klicka i kartan för att sätta ut areapunkter.{" "}
            {!isMobile
              ? 'Högerklicka för att ångra senaste punkten. Dubbelklicka, klicka på "Bekräfta", eller klicka på den första punkten en gång till för att fastställa arean (gummisnodden tas inte med)'
              : 'Tryck på "Bekräfta "för att fastställa arean.'}
            .
          </span>
        ) : activeTool === "place-text" ? (
          <span className="text--bold">
            Klicka i kartan för att välja en position och öppna Text-dialogen.
          </span>
        ) : activeTool === "move-object" ? (
          <span className="text--bold">
            Dra och släpp för att flytta dina objekt i kartan. "Bekräfta"
            fastställer dina ändringar.
            <br /> "Avbryt" återställer dina ändringar och lämnar verktyget.
          </span>
        ) : (
          <span>
            <span className="text--bold">
              Klicka i kartan för att välja en position för din punkt.
            </span>{" "}
            I nästa steg kan du redigera din punkts utseende och/eller ändra
            position med verktyget "Flytta objekt" i verktygsmenyn.
          </span>
        )}
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
