import { aiLog, notify } from "@aicore-fivem/lib/server";
import { Locale, PMA } from "common";
import type { Players } from "./players";

/** Admin mutes with their timers (pma-voice `/muteply`: a toggle, 900 s by default). */
export class Mutes {
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(private readonly players: Players) {}

  /** Mutes or unmutes `target`; `by` is the admin (0 = console). False when the target has no voice state. */
  toggle(target: number, by: number, seconds: number): boolean {
    const player = this.players.get(target);
    if (!player) return false;
    const muted = !player.muted;
    this.clear(target);
    this.players.setMuted(target, muted);
    emit(PMA.playerMuted, target, by, muted, seconds);
    if (muted)
      this.timers.set(
        target,
        setTimeout(() => {
          this.timers.delete(target);
          this.players.setMuted(target, false);
          emit(PMA.playerMuted, target, 0, false, 0);
        }, seconds * 1000),
      );
    notify(target, Locale(muted ? "NOTIFY_MUTED" : "NOTIFY_UNMUTED"), "info");
    aiLog("mutes", muted ? "voice muted" : "voice unmuted", {
      source: by > 0 ? by : undefined,
      target,
      metadata: { seconds: muted ? seconds : 0 },
    });
    return true;
  }

  /** The player left: their timer goes with them (Enhanced reuses the id). */
  clear(source: number): void {
    const timer = this.timers.get(source);
    if (timer) clearTimeout(timer);
    this.timers.delete(source);
  }
}
