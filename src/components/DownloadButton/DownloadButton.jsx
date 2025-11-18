// src/components/DownloadButton/DownloadButton.jsx
import "./DownloadButton.css";
import { useState, useRef, useEffect } from "react";

export default function DownloadButton({
  isMobile,
  onClickPdf,
  onClickJson,
  onClick,
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  function toggleOpen(e) {
    e.stopPropagation();
    setOpen((prev) => !prev);
  }

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    function onDocClick(e) {
      if (!btnRef.current) return;
      if (!btnRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const handlePdf = (e) => {
    e.preventDefault();
    e.stopPropagation();
    (onClickPdf || onClick)?.(); // fallback to onClick for backwards compat
    close();
  };

  const handleJson = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClickJson?.();
    close();
  };

  return (
    <button
      ref={btnRef}
      className="button button--primary btn-save-my-map"
      id="btn-save-my-map"
      onClick={toggleOpen}
      title="Ladda ner"
      type="button"
    >
      <i className="btn-icon">
        <img
          className="download-icon"
          src="/icon-download--black.svg"
          alt="Download-icon"
        />
      </i>
      {isMobile ? "Ladda ner" : "Ladda ner karta"}
      {open && (
        <ul className="btn__dropdown-list" onClick={(e) => e.stopPropagation()}>
          <li className="btn__dropdown-list__li-item">
            <a
              href="#"
              title="Ladda ner din karta som en PDF"
              onClick={handlePdf}
            >
              Karta som PDF
            </a>
          </li>
          <hr className="btn__dropdown-list__hr" />
          <li className="btn__dropdown-list__li-item">
            <a
              href="#"
              title="Ladda ner Mina objekt som en GeoJSON-fil"
              onClick={handleJson}
            >
              Geometrier som JSON
            </a>
          </li>
        </ul>
      )}
    </button>
  );
}
