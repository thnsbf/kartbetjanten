// src/modules/labelDraft.js
import { Color, Cartesian2, LabelStyle } from "cesium";

// Turn a Cesium entity.label into a draft for editing
export function draftFromEntityLabel(entity) {
  let text = entity.label?.text || "";
  // unwrap Cesium ConstantProperty if necessary
  if (text && typeof text.getValue === "function") {
    text = text.getValue();
  }
  if (typeof text !== "string") text = String(text ?? "");
  const font = entity.label?.font || "18px Barlow";
  const fontSize = parseInt(font, 10) || 18;

  const toHex = (c) => {
    if (!c) return "#ffffff";
    const r = Math.round((c.red ?? 1) * 255).toString(16).padStart(2, "0");
    const g = Math.round((c.green ?? 1) * 255).toString(16).padStart(2, "0");
    const b = Math.round((c.blue ?? 1) * 255).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  };
  const backgroundColor = typeof entity.label?.backgroundColor === "string" ? entity.label?.backgroundColor : entity.label?.backgroundColor.value || entity.label?.backgroundColor._value
  const textColor = typeof entity.label?.fillColor === "string" ? entity.label?.fillColor : entity.label?.fillColor.value || entity.label?.fillColor._value

  return {
    text,
    fontSize,
    color: toHex(textColor),
    backgroundColor: toHex(backgroundColor),
  };
}

// Apply a draft to an entity.label (create or update)
export function applyDraftToEntityLabel(entity, draft) {
  if (!entity.label) entity.label = {};
  entity.label.text = draft.text.trim();
  entity.label.font = `${draft.fontSize}px Barlow`;
  entity.label.style = LabelStyle.FILL_AND_OUTLINE;
  entity.label.fillColor = Color.fromCssColorString(draft.color);
  entity.label.outlineColor = Color.fromCssColorString("#000");
  entity.label.outlineWidth = 0;
  entity.label.showBackground = true;
  entity.label.backgroundColor = Color.fromCssColorString(draft.backgroundColor);
  entity.label.backgroundPadding = new Cartesian2(8, 6);
  entity.label.pixelOffset = new Cartesian2(0, -12);
  entity.label.disableDepthTestDistance = Number.POSITIVE_INFINITY;
}
