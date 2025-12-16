import { useState, useRef, useEffect } from "react";
import "./DownloadButton.css";
import { isUnsupportedIosBrowser } from "../../modules/download-helpers";

export default function DownloadButton({
  isMobile,
  onClickPdf,
  onClickJson,
  onClick,
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const unsupportedIosBrowser = isUnsupportedIosBrowser();

  function toggleOpen(e) {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const showIosWarning = (kind) => {
    alert(
      `Nedladdning av ${kind} fungerar tyvärr inte i den här webbläsaren på iPhone.\n\n` +
        `Öppna sidan i Safari om du vill ladda ner filen.`
    );
  };

  const handlePdf = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (unsupportedIosBrowser) {
      showIosWarning("PDF");
      close();
      return;
    }

    (onClickPdf || onClick)?.();
    close();
  };

  const handleJson = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (unsupportedIosBrowser) {
      showIosWarning("JSON");
      close();
      return;
    }

    onClickJson?.();
    close();
  };

  return (
    <div ref={wrapperRef} className="btn-save-my-map-wrapper">
      <button
        className="button button--primary btn-save-my-map"
        id="btn-save-my-map"
        onClick={toggleOpen}
        title="Ladda ner"
        type="button"
      >
        <i className="btn-icon">
          <img
            className="download-icon"
            src="icon-download--black.svg"
            alt="Download-icon"
          />
        </i>
        {isMobile ? "Ladda ner" : "Ladda ner karta"}
      </button>

      {open && (
        <ul className="btn__dropdown-list" onClick={(e) => e.stopPropagation()}>
          <li className="btn__dropdown-list__li-item">
            <button
              type="button"
              className="btn__dropdown-list__button"
              onClick={handlePdf}
            >
              Karta som PDF
            </button>
          </li>
          <hr className="btn__dropdown-list__hr" />
          <li className="btn__dropdown-list__li-item">
            <button
              type="button"
              className="btn__dropdown-list__button"
              onClick={handleJson}
            >
              Geometrier som JSON
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
