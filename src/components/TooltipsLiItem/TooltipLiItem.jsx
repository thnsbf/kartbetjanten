import "./TooltipLiItem.css";

export default function TooltipLiItem({ text }) {
  return (
    <li className="tooltip-li-item">
      <svg
        className="tooltip-icon"
        xmlns="http://www.w3.org/2000/svg"
        width="23"
        height="18"
        viewBox="0 0 23 18"
        fill="none"
      >
        <path
          d="M21.3871 4.6489L18.3727 1.61652C17.52 0.758733 16.1249 0.801653 15.3259 1.71025L11.8007 5.71897C11.6157 5.92941 11.2893 5.92941 11.1042 5.71897L7.59343 1.72664C6.78909 0.811979 5.38236 0.7755 4.53395 1.64488L1.56738 4.68488C0.7706 5.50198 0.777545 6.80946 1.58288 7.61825L9.80449 15.8778C10.6962 16.7735 12.1465 16.7717 13.036 15.8738L21.4093 7.60306C22.2054 6.77763 22.1956 5.46216 21.3871 4.6489Z"
          fill="currentColor"
          stroke="currentColor"
        />
      </svg>
      <p className="tooltip-li-item__text">{text || ""}</p>
    </li>
  );
}
