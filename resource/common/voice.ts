import { bool, int, isRecord, num, str } from "@aicore-fivem/lib/shared";

/** ai-voice's own events (client -> server). */
export const EVENTS = {
  setMode: "ai-voice:setMode",
  setRange: "ai-voice:setRange",
} as const;

/**
 * pma-voice's net and local events, kept by name and payload: ai-hud and third-party radio / phone scripts listen to
 * them, and some send the client -> server ones themselves.
 */
export const PMA = {
  setPlayerRadio: "pma-voice:setPlayerRadio",
  setTalkingOnRadio: "pma-voice:setTalkingOnRadio",
  setPlayerCall: "pma-voice:setPlayerCall",
  syncRadioData: "pma-voice:syncRadioData",
  addPlayerToRadio: "pma-voice:addPlayerToRadio",
  removePlayerFromRadio: "pma-voice:removePlayerFromRadio",
  clSetPlayerRadio: "pma-voice:clSetPlayerRadio",
  syncCallData: "pma-voice:syncCallData",
  addPlayerToCall: "pma-voice:addPlayerToCall",
  removePlayerFromCall: "pma-voice:removePlayerFromCall",
  clSetPlayerCall: "pma-voice:clSetPlayerCall",
  setTalkingMode: "pma-voice:setTalkingMode",
  radioActive: "pma-voice:radioActive",
  toggleRadioAnim: "pma-voice:toggleRadioAnim",
  settingsCallback: "pma-voice:settingsCallback",
  playerMuted: "pma-voice:playerMuted",
} as const;

/** State bag keys: pma-voice's player keys and ai-voice's backend key. */
export const KEYS = {
  backend: "ai-voice:backend",
  proximity: "proximity",
  radioChannel: "radioChannel",
  callChannel: "callChannel",
  muted: "muted",
  /** pma-voice's death flag (death scripts written for pma); ai-core's own is PLAYER_BAGS.dead. */
  isDead: "isDead",
} as const;

/** Who routes the audio: the clients through Mumble (Legacy) or the server through voice channels (Enhanced). */
export type Backend = "mumble" | "enhanced";
export const parseBackend = (v: unknown): Backend | undefined =>
  v === "mumble" || v === "enhanced" ? v : undefined;

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
/** A radio frequency or call id: pma takes any number; 0 = none. */
export const CHANNEL_MAX = 1_000_000;

export const isChannel = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= CHANNEL_MAX;
/** pma-voice exports take the channel as a number or a numeric string. */
export const toChannel = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return isChannel(n) ? n : null;
};

export interface VoiceMode {
  label: string;
  distance: number;
}

export type BackendSetting = "auto" | Backend;

/** The panel's settings file, read the same way on both sides. */
export interface Settings {
  backend: BackendSetting;
  modes: VoiceMode[];
  /** 1-based index into `modes`. */
  defaultMode: number;
  cycle: boolean;
  radio: boolean;
  radioVolume: number;
  radioAnim: boolean;
  radioAnimInVehicle: boolean;
  radioSubmix: boolean;
  micClicks: boolean;
  syncNames: boolean;
  phone: boolean;
  phoneVolume: number;
  phoneSubmix: boolean;
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

export function readSettings(raw: Record<string, unknown>): Settings {
  const modes = readModes(raw.modes);
  const backend = raw.backend;
  return {
    backend: backend === "enhanced" || backend === "mumble" ? backend : "auto",
    modes,
    defaultMode: int(raw.defaultMode, 2, 1, modes.length),
    cycle: bool(raw.cycle, true),
    radio: bool(raw.radio, true),
    radioVolume: int(raw.radioVolume, 30, 0, 100),
    radioAnim: bool(raw.radioAnim, false),
    radioAnimInVehicle: bool(raw.radioAnimInVehicle, true),
    radioSubmix: bool(raw.radioSubmix, true),
    micClicks: bool(raw.micClicks, true),
    syncNames: bool(raw.syncNames, false),
    phone: bool(raw.phone, true),
    phoneVolume: int(raw.phoneVolume, 60, 0, 100),
    phoneSubmix: bool(raw.phoneSubmix, true),
  };
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
