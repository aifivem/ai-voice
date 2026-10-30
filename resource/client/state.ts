import {
  AdminWorld,
  GlobalKey,
  PlayerState,
  stateBoolean,
} from "@aicore-fivem/lib/client";
import { createLogger, isRecord } from "@aicore-fivem/lib/shared";
import { PLAYER_BAGS } from "@aicore-fivem/shared";
import {
  KEYS,
  parseBackend,
  parseProximity,
  readSettings,
  ResourceName,
  type Settings,
} from "common";

export const log = createLogger(ResourceName);
export const backendKey = new GlobalKey(KEYS.backend, parseBackend);
export const proximityBag = new PlayerState(KEYS.proximity, parseProximity);
export const deadBag = new PlayerState(PLAYER_BAGS.dead, stateBoolean);
export const pmaDeadBag = new PlayerState(KEYS.isDead, stateBoolean);

const world = new AdminWorld(["settings"]);
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

/** Everything the client halves share: panel settings, the player's preferences, radio and call members. */
class VoiceState {
  settings: Settings = readSettings(world.get("settings"));
  readonly prefs = loadPrefs();
  /** Radio members (server id -> talking) and call members, as the server sent them. */
  readonly radio = new Map<number, boolean>();
  readonly call = new Map<number, boolean>();
  radioChannel = 0;
  callChannel = 0;
  radioPressed = false;
  /** pma-voice `setVoiceProperty("radioEnabled")`. */
  radioEnabled = true;
  /** Scripts that turned the radio off (`addRadioDisableBit`). */
  radioDisableBits = 0;
  /** pma-voice `setAllowProximityCycleState(true)` or an override with `disableCycle`. */
  cycleBlocked = false;
  readonly mutedLocally = new Set<number>();
  private readonly listeners: Array<() => void> = [];

  constructor() {
    world.onChange("settings", () => {
      this.settings = readSettings(world.get("settings"));
      for (const listener of this.listeners) listener();
    });
  }

  onSettings(listener: () => void): void {
    this.listeners.push(listener);
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
