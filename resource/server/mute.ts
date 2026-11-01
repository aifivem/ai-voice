import {
  aiLog,
  aiLogChannels,
  notify,
  PlayerMap,
} from "@aicore-fivem/lib/server";
import { Locale, PMA } from "common";
import type { Players } from "./players";

aiLogChannels({ mutes: {} });

/** setTimeout holds at most 2^31-1 ms (~24.8 days); longer waits re-arm. */
const MAX_TIMEOUT = 2_147_483_647;
/** The longest mute: one year. */
export const MAX_MUTE_SECONDS = 365 * 24 * 3600;

/** A mute by account: it survives a reconnect (server ids are reused, licenses are not). */
interface Mute {
  until: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const licenseOf = (source: number): string =>
  GetPlayerIdentifierByType(String(source), "license") || `source:${source}`;

/** Admin mutes (pma-voice `/muteply`: a toggle, 900 s by default), kept by license until they run out. */
export class Mutes {
  private readonly mutes = new Map<string, Mute>();
  /** The license of each connected muted player (drop does not need a native call; the mute stays with the license). */
  private readonly online = new PlayerMap<string>();

  constructor(private readonly players: Players) {}

  /** Mutes or unmutes `target`; `by` is the admin (0 = console). False when the target has no voice state. */
  toggle(target: number, by: number, seconds: number): boolean {
    const player = this.players.get(target);
    if (!player) return false;
    const license = licenseOf(target);
    const muted = !this.mutes.has(license);
    const time = Math.min(MAX_MUTE_SECONDS, Math.max(1, seconds));
    if (muted) {
      this.mutes.set(license, { until: Date.now() + time * 1000, timer: null });
      this.arm(license);
      this.apply(target, license, true);
    } else this.end(license, false);
    emit(PMA.playerMuted, target, by, muted, time);
    notify(target, Locale(muted ? "NOTIFY_MUTED" : "NOTIFY_UNMUTED"), "info");
    aiLog("mutes", muted ? "voice muted" : "voice unmuted", {
      source: by > 0 ? by : undefined,
      target,
      metadata: { seconds: muted ? time : 0 },
    });
    return true;
  }

  /** A player joined: a mute that has not run out applies again. */
  join(source: number): void {
    const license = licenseOf(source);
    const mute = this.mutes.get(license);
    if (mute && mute.until > Date.now()) this.apply(source, license, true);
  }

  private apply(source: number, license: string, muted: boolean): void {
    if (muted) this.online.set(source, license);
    else this.online.delete(source);
    this.players.setMuted(source, muted);
  }

  private arm(license: string): void {
    const mute = this.mutes.get(license);
    if (!mute) return;
    const left = mute.until - Date.now();
    if (left <= 0) return this.end(license);
    mute.timer = setTimeout(
      () => this.arm(license),
      Math.min(left, MAX_TIMEOUT),
    );
  }

  /** The mute is over; `announce`: tell other scripts (a manual unmute announces itself). */
  private end(license: string, announce = true): void {
    const mute = this.mutes.get(license);
    if (!mute) return;
    if (mute.timer) clearTimeout(mute.timer);
    this.mutes.delete(license);
    for (const [source, l] of this.online)
      if (l === license) {
        this.apply(source, license, false);
        if (announce) emit(PMA.playerMuted, source, 0, false, 0);
      }
  }
}
