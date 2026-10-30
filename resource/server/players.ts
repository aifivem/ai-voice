import {
  PlayerState,
  stateBoolean,
  stateNumber,
} from "@aicore-fivem/lib/server";
import { PLAYER_BAGS } from "@aicore-fivem/shared";
import {
  CUSTOM_MODE,
  KEYS,
  parseProximity,
  proximityOf,
  type Proximity,
} from "common/voice";
import { checks } from "./checks";
import { content } from "./content";
import type { Router, Talker } from "./router";

export const proximityBag = new PlayerState(PLAYER_BAGS.proximity, parseProximity);
export const radioBag = new PlayerState(KEYS.radioChannel, stateNumber);
export const callBag = new PlayerState(KEYS.callChannel, stateNumber);
export const mutedBag = new PlayerState(KEYS.muted, stateBoolean);
export const speakerBag = new PlayerState(KEYS.callSpeaker, stateBoolean);

/** One connected player's voice state; the server is its only writer. */
export class VoicePlayer implements Talker {
  /** 1-based index into the panel's ranges. */
  mode: number;
  /** A range a script set (`overrideProximityRange`), else null. */
  range: number | null = null;
  /** The frequency push-to-talk sends on (0 = none); always one of `radios`. */
  radio = 0;
  /** Every frequency the player hears. */
  readonly radios = new Set<number>();
  call = 0;
  speaker = false;
  muted = false;

  constructor(readonly source: number) {
    this.mode = content.settings.defaultMode;
  }

  get distance(): number {
    return this.range ?? proximityOf(content.settings, this.mode).distance;
  }

  proximity(): Proximity {
    const base = proximityOf(content.settings, this.mode);
    return this.range === null
      ? base
      : { index: this.mode, distance: this.range, mode: CUSTOM_MODE };
  }
}

/** Every connected player's voice state by server id (cleared on drop: Enhanced reuses ids). */
export class Players {
  private readonly players = new Map<number, VoicePlayer>();

  constructor(private readonly router: Router) {}

  get(source: number): VoicePlayer | undefined {
    return this.players.get(source);
  }

  all(): IterableIterator<VoicePlayer> {
    return this.players.values();
  }

  join(source: number): VoicePlayer {
    const existing = this.players.get(source);
    if (existing) return existing;
    const player = new VoicePlayer(source);
    this.players.set(source, player);
    proximityBag.set(source, player.proximity());
    radioBag.set(source, 0);
    callBag.set(source, 0);
    mutedBag.set(source, false);
    speakerBag.set(source, false);
    this.router.join(player);
    return player;
  }

  drop(source: number): void {
    this.players.delete(source);
    this.router.forget(source);
  }

  /** A range of the panel (1-based); false when it does not exist or a script refused it. */
  setMode(source: number, index: number): boolean {
    const player = this.players.get(source);
    if (!player || index < 1 || index > content.settings.modes.length)
      return false;
    const distance = proximityOf(content.settings, index).distance;
    if (!checks.canSetRange(source, index, distance)) return false;
    player.mode = index;
    player.range = null;
    this.apply(player);
    return true;
  }

  /** A range set by a script, or null to go back to the selected range. */
  setRange(source: number, range: number | null): boolean {
    const player = this.players.get(source);
    if (!player) return false;
    if (range !== null && !checks.canSetRange(source, player.mode, range))
      return false;
    player.range = range;
    this.apply(player);
    return true;
  }

  setMuted(source: number, muted: boolean): void {
    const player = this.players.get(source);
    if (!player || player.muted === muted) return;
    player.muted = muted;
    mutedBag.set(source, muted);
    this.router.update(player);
  }

  /** The panel's ranges changed: clamp every player's range index and place everyone again. */
  reload(): void {
    const count = content.settings.modes.length;
    for (const player of this.players.values()) {
      if (player.mode > count) player.mode = content.settings.defaultMode;
      proximityBag.set(player.source, player.proximity());
    }
    this.router.rebuild(this.players.values());
  }

  private apply(player: VoicePlayer): void {
    proximityBag.set(player.source, player.proximity());
    this.router.update(player);
  }
}
