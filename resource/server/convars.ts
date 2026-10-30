import { createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import type { AdminPanel } from "@aicore-fivem/lib/server";
import { SETTINGS_DEFAULTS } from "./schema";

const log = createLogger(ResourceName);

type Key = keyof typeof SETTINGS_DEFAULTS;

/** pma-voice's cfg convars and the panel setting each one seeds. */
const CONVARS: Array<{
  name: string;
  keys: Key[];
  read: (raw: string) => unknown;
}> = [
  { name: "voice_defaultVoiceMode", keys: ["defaultMode"], read: int },
  { name: "voice_enableProximityCycle", keys: ["cycle"], read: flag },
  { name: "voice_enableRadios", keys: ["radio"], read: flag },
  { name: "voice_enablePhones", keys: ["phone"], read: flag },
  { name: "voice_defaultRadioVolume", keys: ["radioVolume"], read: volume },
  { name: "voice_defaultPhoneVolume", keys: ["phoneVolume"], read: volume },
  { name: "voice_defaultCallVolume", keys: ["phoneVolume"], read: volume },
  {
    name: "voice_enableSubmix",
    keys: ["radioSubmix", "phoneSubmix"],
    read: flag,
  },
  { name: "voice_enableRadioAnim", keys: ["radioAnim"], read: flag },
  {
    name: "voice_disableVehicleRadioAnim",
    keys: ["radioAnimInVehicle"],
    read: (raw) => !flag(raw),
  },
  { name: "voice_syncPlayerNames", keys: ["syncNames"], read: flag },
];

function int(raw: string): number | undefined {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : undefined;
}

function flag(raw: string): boolean {
  return raw === "1" || raw === "true";
}

/** pma-voice took 0-100; a float like 0.3 (old pma) means 30. */
function volume(raw: string): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(Math.min(100, n <= 1 && raw.includes(".") ? n * 100 : n));
}

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * pma-voice's convars from the cfg files seed the panel once: a convar that is set replaces a setting still at its
 * built-in default and is written into the panel, so the panel wins from then on.
 */
export function seedFromConvars(panel: AdminPanel): void {
  const settings = panel.get("settings");
  for (const convar of CONVARS) {
    const raw = GetConvar(convar.name, "");
    if (raw === "") continue;
    const value = convar.read(raw);
    if (value === undefined) {
      log.warn(`${convar.name} "${raw}" is not a valid value, ignored`);
      continue;
    }
    for (const key of convar.keys) {
      if (!same(settings[key], SETTINGS_DEFAULTS[key])) continue;
      if (same(value, SETTINGS_DEFAULTS[key])) continue;
      panel.commit("settings", key, value);
      log.info(`${key} set from the cfg convar ${convar.name} (${raw})`);
    }
  }
}
