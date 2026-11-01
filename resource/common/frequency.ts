import {
  bool,
  num,
  readAccess,
  str,
  type AccessRule,
  type RecordReader,
} from "@aicore-fivem/lib/shared";

/** A frequency span of the panel: optional access rule, optional animation. */
export interface Frequency {
  label: string;
  from: number;
  to: number;
  /** Who may join (the record's `jobs` / `gangs` / `onDuty`; on duty when the record does not say). */
  access: AccessRule;
  /** "" = the default animation, "none", or a set name. */
  anim: string;
}

/** One frequency record (`records("channels", readFrequency)`). */
export const readFrequency: RecordReader<Frequency> = (_key, value) => ({
  label: str(value.label, "", 48),
  from: num(value.from, 0),
  to: num(value.to, 0),
  access: { ...readAccess(value), onDuty: bool(value.onDuty, true) },
  anim: typeof value.anim === "string" ? value.anim : "",
});

/** The frequency span covering a channel, if any. */
export function frequencyOf(
  list: Iterable<Frequency>,
  channel: number,
): Frequency | undefined {
  for (const f of list) if (channel >= f.from && channel <= f.to) return f;
  return undefined;
}
