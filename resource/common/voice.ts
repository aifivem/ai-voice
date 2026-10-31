import {
  bool,
  int,
  isRecord,
  num,
  readAccess,
  str,
  type AccessRule,
  type RecordReader,
} from "@aicore-fivem/lib/shared";

/** ai-voice's own events. */
export const EVENTS = {
  /** client -> server: a range of the panel (1-based). */
  setMode: "ai-voice:setMode",
  /** client -> server: a script range on the Mumble backend (metres or null). */
  setRange: "ai-voice:setRange",
  /** client -> server: listen to one more frequency (true) or leave it (false). */
  radioListen: "ai-voice:radioListen",
  /** client -> server: talk on this joined frequency. */
  radioActive: "ai-voice:radioActive",
  /** client -> server: phone loudspeaker on / off. */
  setSpeaker: "ai-voice:setSpeaker",
  /** server -> client: who a phone loudspeaker adds `{ send, hear }` (server ids). */
  callAudio: "ai-voice:callAudio",
} as const;

/**
 * pma-voice's net and local events, kept by name and payload: ai-hud and third-party radio / phone scripts listen to
 * them, and some send the client -> server ones themselves. Radio events carry the frequency as one extra last argument
 * (pma's listeners ignore it).
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
  registerCustomSubmixes: "pma-voice:registerCustomSubmixes",
} as const;

/** State bag keys: pma-voice's player keys and ai-voice's own (`proximity` is `PLAYER_BAGS.proximity` in @aicore-fivem/shared). */
export const KEYS = {
  backend: "ai-voice:backend",
  /** Scripts that bring their own radio / phone effect (`Takeover`). */
  takeover: "ai-voice:takeover",
  radioChannel: "radioChannel",
  callChannel: "callChannel",
  muted: "muted",
  /** pma-voice's lasting voice effect of a player: the name of a registered submix. */
  submix: "submix",
  /** The player's phone loudspeaker is on. */
  callSpeaker: "callSpeaker",
  /** pma-voice's death flag (death scripts written for pma); ai-core's own is PLAYER_BAGS.dead. */
  isDead: "isDead",
} as const;

/** Who routes the audio: the clients through Mumble (Legacy) or the server through voice channels (Enhanced). */
export type Backend = "mumble" | "enhanced";
export const parseBackend = (v: unknown): Backend | undefined =>
  v === "mumble" || v === "enhanced" ? v : undefined;

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

/** Built-in radio animations (base game dictionaries). */
export const ANIM_SETS = {
  shoulder: { dict: "random@arrests", clip: "generic_radio_enter", flag: 50 },
  chatter: { dict: "random@arrests", clip: "generic_radio_chatter", flag: 49 },
  handheld: { dict: "cellphone@", clip: "cellphone_text_read_base", flag: 49 },
} as const;
export type AnimSetName = keyof typeof ANIM_SETS | "custom";
export const ANIM_SET_NAMES = ["shoulder", "chatter", "handheld", "custom"];

export interface Anim {
  dict: string;
  clip: string;
  flag: number;
}

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
