import { AdminPanel } from "@aicore-fivem/lib/server";
import { bool, isRecord, num, str } from "@aicore-fivem/lib/shared";
import { readSettings, type Settings } from "common/voice";
import { schema } from "./schema";

export const panel = new AdminPanel(schema);

panel.rule("channels", (_key, next) =>
  isRecord(next) && num(next.from, 0) > num(next.to, 0)
    ? "ADMIN_ERR_CHANNEL_RANGE"
    : null,
);

/** A radio frequency span reserved for jobs (panel tab Restricted channels). */
export interface Restriction {
  label: string;
  from: number;
  to: number;
  jobs: string[];
  onDuty: boolean;
}

function readRestrictions(raw: Record<string, unknown>): Restriction[] {
  const list: Restriction[] = [];
  for (const value of Object.values(raw)) {
    if (!isRecord(value)) continue;
    list.push({
      label: str(value.label, "", 48),
      from: num(value.from, 0),
      to: num(value.to, 0),
      jobs: Array.isArray(value.jobs)
        ? value.jobs.filter((j): j is string => typeof j === "string")
        : [],
      onDuty: bool(value.onDuty, true),
    });
  }
  return list;
}

/** The parsed panel content, read again after every change; `onSettings` hears a settings change. */
class Content {
  settings: Settings = readSettings(panel.get("settings"));
  restrictions: Restriction[] = readRestrictions(panel.get("channels"));
  private readonly listeners: Array<(next: Settings, old: Settings) => void> =
    [];

  constructor() {
    panel.onChange("settings", () => {
      const old = this.settings;
      this.settings = readSettings(panel.get("settings"));
      for (const listener of this.listeners) listener(this.settings, old);
    });
    panel.onChange("channels", () => {
      this.restrictions = readRestrictions(panel.get("channels"));
    });
  }

  onSettings(listener: (next: Settings, old: Settings) => void): void {
    this.listeners.push(listener);
  }

  /** The restriction covering a frequency, if any. */
  restrictionOf(channel: number): Restriction | undefined {
    return this.restrictions.find((r) => channel >= r.from && channel <= r.to);
  }
}

export const content = new Content();
