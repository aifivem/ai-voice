import {
  AdminWorld,
  GlobalKey,
  PlayerState,
  stateBoolean,
  stateString,
} from "@aicore-fivem/lib/client";
import { createLogger, isRecord } from "@aicore-fivem/lib/shared";
import { PLAYER_BAGS } from "@aicore-fivem/shared";
import {
  KEYS,
  parseBackend,
  parseProximity,
  parseTakeover,
  readFrequencies,
  readSettings,
  ResourceName,
  type Frequency,
  type Settings,
} from "common";

export const log = createLogger(ResourceName);
export const backendKey = new GlobalKey(KEYS.backend, parseBackend);
export const takeoverKey = new GlobalKey(KEYS.takeover, parseTakeover);
export const proximityBag = new PlayerState(KEYS.proximity, parseProximity);
export const deadBag = new PlayerState(PLAYER_BAGS.dead, stateBoolean);
export const pmaDeadBag = new PlayerState(KEYS.isDead, stateBoolean);
export const submixBag = new PlayerState(KEYS.submix, stateString);
export const speakerBag = new PlayerState(KEYS.callSpeaker, stateBoolean);

const world = new AdminWorld(["settings", "channels"]);
const KVP = "ai-voice:prefs";

/** The player's own voice preferences (client KVP, versioned JSON). */
interface Prefs {
  v: 1;
  radio: number | null;
  phone: number | null;
  micClicks: boolean | null;
}

function loadPrefs(): Prefs {
  const empty: Prefs = { v: 1, radio: null, phone: null, micClicks: null };
  const raw = GetResourceKvpString(KVP);
  if (!raw) return empty;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== 1) return empty;
    const pct = (v: unknown) =>
      typeof v === "number" && v >= 0 && v <= 100 ? v : null;
    return {
      v: 1,
      radio: pct(parsed.radio),
      phone: pct(parsed.phone),
      micClicks:
        typeof parsed.micClicks === "boolean" ? parsed.micClicks : null,
    };
  } catch (error) {
    log.warn("voice preferences were broken and are reset", error);
    return empty;
  }
}

/** What a phone loudspeaker adds for this client (server ids): whom to reach, whom to hear. */
export interface SpeakerAudio {
  send: number[];
  call: number[];
  speaker: number[];
}

/** Everything the client halves share: panel content, preferences, frequencies, call, outside routing. */
class VoiceState {
  settings: Settings = readSettings(world.get("settings"));
  frequencies: Frequency[] = readFrequencies(world.get("channels"));
  readonly prefs = loadPrefs();
  /** Members (server id -> talking) of every frequency this player hears. */
  readonly radios = new Map<number, Map<number, boolean>>();
  /** The frequency push-to-talk sends on (the server decides). */
  radioChannel = 0;
  readonly call = new Map<number, boolean>();
  callChannel = 0;
  speakerAudio: SpeakerAudio = { send: [], call: [], speaker: [] };
  radioPressed = false;
  /** pma-voice `setVoiceProperty("radioEnabled")`. */
  radioEnabled = true;
  /** Scripts that turned the radio off (`addRadioDisableBit`). */
  radioDisableBits = 0;
  /** pma-voice `setAllowProximityCycleState(true)` or an override with `disableCycle`. */
  cycleBlocked = false;
  readonly mutedLocally = new Set<number>();
  /** tgiann-radio-v2 runs its own radio: its push-to-talk state and members (its local `syncRadioData`). */
  externalRadioPressed = false;
  readonly externalRadio = new Set<number>();
  /** tgiann-phone routes calls itself: the players its call audio must reach. */
  readonly externalCall = new Set<number>();
  private readonly listeners: Array<() => void> = [];

  constructor() {
    world.onChange("settings", () => {
      this.settings = readSettings(world.get("settings"));
      for (const listener of this.listeners) listener();
    });
    world.onChange("channels", () => {
      this.frequencies = readFrequencies(world.get("channels"));
    });
  }

  onSettings(listener: () => void): void {
    this.listeners.push(listener);
  }

  /** Members of the active frequency. */
  activeMembers(): ReadonlyMap<number, boolean> {
    return this.radios.get(this.radioChannel) ?? new Map();
  }

  /** Whether a player is on any frequency this client hears. */
  onAnyRadio(id: number): boolean {
    for (const members of this.radios.values())
      if (members.has(id)) return true;
    return false;
  }

  /** Radio and phone volume, 0-1: the player's choice, else the panel's default. */
  volume(kind: "radio" | "phone"): number {
    const pref = this.prefs[kind];
    const pct =
      pref ??
      (kind === "radio"
        ? this.settings.radioVolume
        : this.settings.phoneVolume);
    return pct / 100;
  }

  micClicks(): boolean {
    return this.prefs.micClicks ?? this.settings.micClicks;
  }

  savePrefs(): void {
    SetResourceKvp(KVP, JSON.stringify(this.prefs));
  }
}

export const state = new VoiceState();
