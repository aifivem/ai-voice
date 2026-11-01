/** Built-in radio animations (base game dictionaries). */
export const ANIM_SETS = {
  shoulder: { dict: "random@arrests", clip: "generic_radio_enter", flag: 50 },
  chatter: { dict: "random@arrests", clip: "generic_radio_chatter", flag: 49 },
  handheld: { dict: "cellphone@", clip: "cellphone_text_read_base", flag: 49 },
} as const;
export type AnimSetName = keyof typeof ANIM_SETS | "custom";
export const ANIM_SET_NAMES = ["shoulder", "chatter", "handheld", "custom"];

export interface Anim {
  dict: string;
  clip: string;
  flag: number;
}
