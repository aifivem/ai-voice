import { isRecord } from "@aicore-fivem/lib/shared";

/** pma-voice's `proximity` bag: `index` is 1-based like pma's voice modes. */
export interface Proximity {
  index: number;
  distance: number;
  mode: string;
}
export const parseProximity = (v: unknown): Proximity | undefined =>
  isRecord(v) &&
  typeof v.index === "number" &&
  typeof v.distance === "number" &&
  typeof v.mode === "string"
    ? { index: v.index, distance: v.distance, mode: v.mode }
    : undefined;

/** The label pma-voice writes into `proximity.mode` for a range set by a script. */
export const CUSTOM_MODE = "Custom";
/** Bounds of a range a script may set (`overrideProximityRange`), metres. */
export const RANGE_MIN = 0.5;
export const RANGE_MAX = 100;
