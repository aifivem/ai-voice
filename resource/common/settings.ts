import { bool, int, isRecord, num, str } from "@aicore-fivem/lib/shared";
import { ANIM_SET_NAMES, ANIM_SETS, type Anim, type AnimSetName } from "./anim";
import type { BackendSetting } from "./backend";
import { RANGE_MAX, RANGE_MIN, type Proximity } from "./proximity";

export interface VoiceMode {
  label: string;
  distance: number;
}

/** The panel's settings file, read the same way on both sides. */
export interface Settings {
  backend: BackendSetting;
  modes: VoiceMode[];
  /** 1-based index into `modes`. */
  defaultMode: number;
  cycle: boolean;
  /** Legacy: players are targeted within this many times the range (native audio carries further). */
  rangeFactor: number;
  radio: boolean;
  radioVolume: number;
  /** Frequencies a player can be on at once (listening; talking on one of them). */
  maxRadioChannels: number;
  radioAnim: boolean;
  radioAnimSet: AnimSetName;
  radioAnimCustom: Anim;
  radioAnimInVehicle: boolean;
  radioSubmix: boolean;
  micClicks: boolean;
  syncNames: boolean;
  phone: boolean;
  phoneVolume: number;
  phoneSubmix: boolean;
  /** Clients may join calls themselves (phones that join from the client, e.g. lb-phone). */
  clientCalls: boolean;
  speaker: boolean;
  speakerRadius: number;
  speakerVolume: number;
  speakerBidirectional: boolean;
}

export const DEFAULT_MODES: VoiceMode[] = [
  { label: "Whisper", distance: 1.5 },
  { label: "Normal", distance: 3 },
  { label: "Shouting", distance: 6 },
];

function readModes(value: unknown): VoiceMode[] {
  if (!Array.isArray(value)) return DEFAULT_MODES;
  const modes: VoiceMode[] = [];
  for (const row of value) {
    if (!isRecord(row)) continue;
    const distance = num(row.distance, 0, RANGE_MIN, RANGE_MAX);
    if (distance > 0)
      modes.push({ label: str(row.label, `${distance} m`, 24), distance });
  }
  return modes.length ? modes : DEFAULT_MODES;
}

const animSet = (v: unknown, fallback: AnimSetName): AnimSetName =>
  typeof v === "string" && ANIM_SET_NAMES.includes(v)
    ? (v as AnimSetName)
    : fallback;

export function readSettings(raw: Record<string, unknown>): Settings {
  const modes = readModes(raw.modes);
  const backend = raw.backend;
  return {
    backend: backend === "enhanced" || backend === "mumble" ? backend : "auto",
    modes,
    defaultMode: int(raw.defaultMode, 2, 1, modes.length),
    cycle: bool(raw.cycle, true),
    rangeFactor: num(raw.rangeFactor, 3, 1, 5),
    radio: bool(raw.radio, true),
    radioVolume: int(raw.radioVolume, 30, 0, 100),
    maxRadioChannels: int(raw.maxRadioChannels, 3, 1, 10),
    radioAnim: bool(raw.radioAnim, false),
    radioAnimSet: animSet(raw.radioAnimSet, "shoulder"),
    radioAnimCustom: {
      dict: str(raw.radioAnimDict, ANIM_SETS.shoulder.dict, 64),
      clip: str(raw.radioAnimClip, ANIM_SETS.shoulder.clip, 64),
      flag: int(raw.radioAnimFlag, 49, 0, 1023),
    },
    radioAnimInVehicle: bool(raw.radioAnimInVehicle, true),
    radioSubmix: bool(raw.radioSubmix, true),
    micClicks: bool(raw.micClicks, true),
    syncNames: bool(raw.syncNames, false),
    phone: bool(raw.phone, true),
    phoneVolume: int(raw.phoneVolume, 60, 0, 100),
    phoneSubmix: bool(raw.phoneSubmix, true),
    clientCalls: bool(raw.clientCalls, false),
    speaker: bool(raw.speaker, true),
    speakerRadius: num(raw.speakerRadius, 3, 0.5, 15),
    speakerVolume: int(raw.speakerVolume, 60, 0, 100),
    speakerBidirectional: bool(raw.speakerBidirectional, true),
  };
}

/** The animation of a set name (`custom`: the panel's dictionary and clip), null for none. */
export function animOf(settings: Settings, name: string): Anim | null {
  if (name === "none") return null;
  if (name === "custom") return settings.radioAnimCustom;
  const set = ANIM_SETS[name as keyof typeof ANIM_SETS] as Anim | undefined;
  return set ?? null;
}

/** The `proximity` bag value of a mode index (1-based) of the settings. */
export function proximityOf(settings: Settings, index: number): Proximity {
  const mode =
    settings.modes[index - 1] ?? settings.modes[0] ?? DEFAULT_MODES[1];
  return {
    index,
    distance: mode?.distance ?? 3,
    mode: mode?.label ?? "Normal",
  };
}
