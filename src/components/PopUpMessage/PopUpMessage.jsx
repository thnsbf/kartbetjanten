import "./PopUpMessage.css";

const messages = {
  "ios-browser":
    "Nedladdning av karta på mobil enhet fungerar endast på Safari i dagsläget. Vill du spara din karta och/eller dina geometrier rekommenderar vi att byta till Safari alternativt valfri browser på dator (Laptop/Desktop).",
};

export default function PopUpMessage({ message }) {
  const msg = messages[message] || "Error - message not found";

  return (
    <div className="popup-msg-wrapper">
      <p className="popup-msg__text">
        <span className="text--bold">OBS! </span>
        {msg}
      </p>
    </div>
  );
}
