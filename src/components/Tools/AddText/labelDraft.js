// src/components/Tools/AddText/labelDraft.js
import { Color } from "cesium";

function toCssFromColorProperty(prop) {
  try {
    const v = prop?.getValue ? prop.getValue() : prop;
    if (!v) return null;
    // best-effort: Color -> rgba string
    const r = Math.round((v.red ?? 0) * 255);
    const g = Math.round((v.green ?? 0) * 255);
    const b = Math.round((v.blue ?? 0) * 255);
    const a = v.alpha ?? 1;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } catch {
    return null;
  }
}

export function draftFromEntityLabel(ent) {
  // Prefer saved draft if present (created by us)
  if (ent.__draft) {
    // Ensure new key exists for older entities
    return {
      text: ent.__draft.text ?? ent.label?.text ?? "",
      color: ent.__draft.color ?? "#ffffff",
      backgroundColor: ent.__draft.backgroundColor ?? "#111111",
      fontSize: ent.__draft.fontSize ?? 20,
      backgroundEnabled:
        ent.__draft.backgroundEnabled ?? ent.label?.showBackground ?? true,
    };
  }

  // Fallback: best-effort read from live label
  const text = ent.label?.text ?? "";
  const font = ent.label?.font ?? "20px Barlow";
  const fontSize = Number(String(font).split("px")[0]) || 20;
  const colorCss = toCssFromColorProperty(ent.label?.fillColor) ?? "#ffffff";
  const bgCss = toCssFromColorProperty(ent.label?.backgroundColor) ?? "#111111";
  const showBg =
    typeof ent.label?.showBackground === "boolean"
      ? ent.label.showBackground
      : true;

  return {
    text,
    color: colorCss,
    backgroundColor: bgCss,
    fontSize,
    backgroundEnabled: showBg,
  };
}

export function applyDraftToEntityLabel(ent, draft) {
  if (!ent?.label) return;

  const {
    text,
    color = "#ffffff",
    backgroundColor = "#111111",
    fontSize = 20,
    backgroundEnabled = true,
  } = draft || {};

  ent.label.text = text;
  ent.label.font = `${fontSize}px Barlow`;
  ent.label.fillColor = Color.fromCssColorString(color);

  // Show/hide background
  ent.label.showBackground = !!backgroundEnabled;
  ent.label.backgroundColor = Color.fromCssColorString(backgroundColor);

  // Persist for later edits & restore logic
  ent.__draft = {
    text,
    color,
    backgroundColor,
    fontSize,
    backgroundEnabled,
  };
}
