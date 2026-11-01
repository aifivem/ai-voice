import { isRecord } from "@aicore-fivem/lib/shared";

/** The running scripts that apply their own radio / phone effect (resource names), null = ai-voice's. */
export interface Takeover {
  radio: string | null;
  phone: string | null;
}
export const parseTakeover = (v: unknown): Takeover | undefined =>
  isRecord(v)
    ? {
        radio: typeof v.radio === "string" ? v.radio : null,
        phone: typeof v.phone === "string" ? v.phone : null,
      }
    : undefined;
