export default function DownloadButton({ isMobile }) {
  return (
    <button
      title="Ladda ner din karta som en PDF"
      className="button button--primary btn-save-my-map"
      id="btn-save-my-map"
    >
      <i className="btn-icon">
        <img
          className="download-icon"
          src="/icon-download--black.svg"
          alt="Download-icon"
        />
      </i>
      {isMobile ? "Ladda ner" : "Ladda ner karta"}
    </button>
  );
}
