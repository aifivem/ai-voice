import { isRecord } from "@aicore-fivem/lib/shared";

/** A pma-voice member table from the server (`{ [serverId]: talking }`, keys arrive as strings). */
export function parseMembers(value: unknown): Map<number, boolean> | null {
  if (!isRecord(value)) return null;
  const members = new Map<number, boolean>();
  for (const [key, talking] of Object.entries(value)) {
    const id = Number(key);
    if (Number.isInteger(id) && id > 0) members.set(id, talking === true);
  }
  return members;
}

export const isServerId = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

export const isChannelId = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
