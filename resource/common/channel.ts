/** A radio frequency or call id: pma takes any number; 0 = none. */
export const CHANNEL_MAX = 1_000_000;

export const isChannel = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= CHANNEL_MAX;
/** pma-voice exports take the channel as a number or a numeric string. */
export const toChannel = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return isChannel(n) ? n : null;
};
