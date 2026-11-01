import { AdminPanel } from "@aicore-fivem/lib/server";
import { isRecord, num } from "@aicore-fivem/lib/shared";
import { frequencyOf, readFrequency, type Frequency } from "common/frequency";
import { readSettings, type Settings } from "common/settings";
import { seedFromConvars } from "./convars";
import { schema } from "./schema";

export const panel = new AdminPanel(schema);
// The commit calls ai-core's export: not during the module's first run.
setImmediate(() => seedFromConvars(panel));

panel.rule("channels", (_key, next) =>
  isRecord(next) && num(next.from, 0) > num(next.to, 0)
    ? "ADMIN_ERR_CHANNEL_RANGE"
    : null,
);

/** The parsed panel content: settings read again after every change, frequencies per record. */
class Content {
  settings: Settings = readSettings(panel.get("settings"));
  readonly frequencies = panel.records("channels", readFrequency);
  private readonly settingsListeners: Array<
    (next: Settings, old: Settings) => void
  > = [];
  private readonly frequencyListeners: Array<() => void> = [];

  constructor() {
    panel.onChange("settings", () => {
      const old = this.settings;
      this.settings = readSettings(panel.get("settings"));
      for (const listener of this.settingsListeners)
        listener(this.settings, old);
    });
    panel.onChange("channels", () => {
      for (const listener of this.frequencyListeners) listener();
    });
  }

  onSettings(listener: (next: Settings, old: Settings) => void): void {
    this.settingsListeners.push(listener);
  }

  onFrequencies(listener: () => void): void {
    this.frequencyListeners.push(listener);
  }

  /** The frequency span covering a channel, if any. */
  frequencyOf(channel: number): Frequency | undefined {
    return frequencyOf(this.frequencies.values(), channel);
  }

  /**
   * Runtime values the panel shows next to the settings (backend in use, scripts with their own effect), written
   * only when they change; deferred because the commit calls ai-core's export.
   */
  showStatus(values: {
    backendActive?: string;
    radioEffectBy?: string;
    phoneEffectBy?: string;
  }): void {
    setImmediate(() => {
      const current = panel.get("settings");
      const changed = Object.entries(values).some(
        ([key, value]) => current[key] !== value,
      );
      if (changed)
        panel.commit("settings", undefined, { ...current, ...values });
    });
  }
}

export const content = new Content();
