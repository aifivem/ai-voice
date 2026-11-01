import type { WidgetSpec } from "@aicore-fivem/shared";

/** A 0-100 % number field. */
export const pct = (path: string, label: string, hint: string): WidgetSpec => ({
  widget: "number",
  path,
  label,
  hint,
  min: 0,
  max: 100,
  unit: "%",
});
/** The radio animation sets as select options. */
export const animOptions = [
  { value: "shoulder", label: "ADMIN_O_ANIM_SHOULDER" },
  { value: "chatter", label: "ADMIN_O_ANIM_CHATTER" },
  { value: "handheld", label: "ADMIN_O_ANIM_HANDHELD" },
  { value: "custom", label: "ADMIN_O_ANIM_CUSTOM" },
];
