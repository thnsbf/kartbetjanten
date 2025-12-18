// src/components/ActiveToolModal/ActiveToolModal.jsx
import React, { useEffect, useState } from "react";
import "./ActiveToolModal.css"; // optional; uses your existing modal classes too
import TooltipLiItem from "../TooltipsLiItem/TooltipLiItem";

export default function ActiveToolModal({
  open,
  activeTool,
  onConfirmExit,
  onCancelExit,
  isMobile,
}) {
  if (!open) return null;

  const isDrawingLine = activeTool === "draw-lines";
  const isDrawingArea = activeTool === "draw-area";
  const showUndo = isDrawingLine || isDrawingArea;

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

  // Is there at least one placed point in the current drawing?
  const [canUndo, setCanUndo] = useState(false);

  // Listen for drawing-state updates from DrawLines / DrawArea
  useEffect(() => {
    if (!showUndo) {
      setCanUndo(false);
      return;
    }

    const handler = (ev) => {
      const detail = ev?.detail || {};
      // detail: { tool: "draw-lines" | "draw-area", hasPoints: boolean }
      setCanUndo(!!detail.hasPoints);
    };

    window.addEventListener("kb:drawing-state", handler);
    return () => window.removeEventListener("kb:drawing-state", handler);
  }, [showUndo]);

  const handleConfirm = () => {
    // For lines / area we signal “finish” to the tool (it will finalize if valid).
    if (isDrawingLine || isDrawingArea) {
      window.dispatchEvent(new CustomEvent("kb:finish-active-tool"));
    }
    // For markers and text, “confirm” behaves like cancel (just exit the tool).
    onConfirmExit?.();
  };

  const handleCancel = () => {
    onCancelExit?.();
  };

  const handleUndo = () => {
    if (!showUndo || !canUndo) return;
    window.dispatchEvent(new CustomEvent("kb:undo-active-tool"));
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

      <div style={{ marginTop: 0, marginBottom: 12, fontSize: 12 }}>
        Ett verktyg är aktivt. Du kan bekräfta eller avbryta. <br />
        {!isMobile
          ? "Du kan när som helst lämna verktyget genom att högerklicka eller trycka på ESC-knappen på ditt tangentbord."
          : 'Du kan när som helst lämna verktyget genom att trycka på "Avbryt".'}
        <br />
        {!isMobile && <br />}
        {activeTool === "draw-lines" ? (
          <ul className="active-tool__tips-ul">
            <TooltipLiItem text="Klicka i kartan för att sätta ut linjepunkter." />

            {!isMobile ? (
              <>
                <TooltipLiItem
                  text='Högerklicka eller klicka på "Ångra" för att ångra senaste
                punkten.'
                />
                <TooltipLiItem
                  text='Dubbelklicka eller klicka på "Bekräfta" för att
                fastställa linjen (gummisnodden tas inte med).'
                />
              </>
            ) : (
              <>
                <TooltipLiItem text='Klicka på "Ångra" för att ångra senaste punkten.' />
                <TooltipLiItem text='Klicka på "Bekräfta" för att fastställa linjen.' />
              </>
            )}
            <TooltipLiItem text='När du fastställt en linje kan du klicka på den (eller klicka på pennan i "Mina objekt") för att redigera linjens utseende, visa längdtext med mera.' />
            <TooltipLiItem text='Om du vill flytta linjen kan du när som helst aktivera "Flytta objekt"-verktyget i menyn och flytta linjen dit du vill.' />
          </ul>
        ) : activeTool === "draw-area" ? (
          <ul className="active-tool__tips-ul">
            <TooltipLiItem text="Klicka i kartan för att sätta ut areapunkter." />
            {!isMobile ? (
              <>
                <TooltipLiItem text='Högerklicka eller klicka på "Ångra" för att ångra senaste punkten.' />
                <TooltipLiItem text='Dubbelklicka, klicka på "Bekräfta", eller klicka på den första punkten en gång till för att fastställa arean (gummisnodden tas inte med).' />
              </>
            ) : (
              <>
                <TooltipLiItem text='Klicka på "Ångra" för att ångra senaste punkten.' />
                <TooltipLiItem text='Klicka på "Bekräfta" för att fastställa arean.' />
              </>
            )}
            <TooltipLiItem text='När du fastställt en area kan du klicka på den, eller klicka på pennan i "Mina objekt", för att redigera areans utseende, visa text med mera.' />
            <TooltipLiItem text='Om du vill flytta arean kan du när som helst aktivera "Flytta objekt"-verktyget i menyn och flytta arean dit du vill.' />
          </ul>
        ) : activeTool === "place-text" ? (
          <ul className="active-tool__tips-ul">
            <TooltipLiItem text="Klicka i kartan för att välja en position och öppna Text-dialogen." />
            <TooltipLiItem text='När du har fastställt texten kan du klicka på den (eller klicka på pennan i "Mina objekt") för att redigera textens utseende, bakgrund, storlek med mera.' />
            <TooltipLiItem text='Om du vill flytta texten kan du när som helst aktivera "Flytta objekt"-verktyget i menyn och flytta texten dit du vill.' />
          </ul>
        ) : activeTool === "move-object" ? (
          <ul className="active-tool__tips-ul">
            <TooltipLiItem text="Dra och släpp för att flytta dina objekt i kartan." />
            <TooltipLiItem
              text='"Bekräfta"
            fastställer dina ändringar.'
            />
            <TooltipLiItem text='"Avbryt" återställer dina ändringar och lämnar verktyget.' />
          </ul>
        ) : (
          <ul className="active-tool__tips-ul">
            <TooltipLiItem text="Klicka i kartan för att välja en position för din punkt." />
            <TooltipLiItem text='Klicka på "Bekräfta" när du är klar för att avsluta verktyget.' />
            <TooltipLiItem text='Därefter kan du klicka på en punkt (eller klicka på pennan för punkten under "Mina objekt") för att redigera färg, storlek, ikon med mera.' />
            <TooltipLiItem text='Om du vill flytta punkten kan du när som helst aktivera "Flytta objekt"-verktyget i menyn och flytta punkten dit du vill.' />
          </ul>
        )}
      </div>

      <div
        className="modal__btn-container"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        {/* Undo button (only for lines/areas) */}
        {showUndo && (
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            style={{
              padding: "0.6em 2.5em",
              borderRadius: "100vmax",
              border: "1px solid var(--kommunfarg)",
              background: "var(--c-background-white)",
              color: canUndo ? "var(--kommunfarg)" : "rgba(0,0,0,0.4)",
              cursor: canUndo ? "pointer" : "not-allowed",
              fontWeight: 600,
              opacity: canUndo ? 1 : 0.5,
            }}
          >
            Ångra senaste punkt
          </button>
        )}

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
