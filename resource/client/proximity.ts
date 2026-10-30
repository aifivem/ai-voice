import { cache, Keybind } from "@aicore-fivem/lib/client";
import { EVENTS, Locale, PMA } from "common";
import { mumble } from "./mumble";
import { backendKey, proximityBag, state } from "./state";

/** The range the player picked: cycled with a key, set by scripts, applied by the server (the `proximity` bag). */
class Proximity {
  /** The cycle was blocked by `overrideProximityRange(range, true)`; clearing the override unblocks it. */
  private blockedByOverride = false;
  private lastIndex = 0;

  start(): void {
    new Keybind({
      name: "voice_cycle",
      description: Locale("KEYBIND_CYCLE"),
      hintLabel: Locale("KEYBIND_CYCLE_HINT"),
      defaultKey: "F11",
      onPressed: () => this.cycle(),
    });
    proximityBag.onChange((id, value) => {
      if (id !== cache.serverId || !value) return;
      if (backendKey.get() === "mumble") mumble.applyRange();
      if (value.index === this.lastIndex) return;
      this.lastIndex = value.index;
      emit(PMA.setTalkingMode, value.index);
    });
    this.lastIndex = proximityBag.get(cache.serverId)?.index ?? 0;
  }

  /** The next range of the panel's list, back to the first after the last. */
  cycle(): void {
    if (!state.settings.cycle || state.cycleBlocked) return;
    const current = proximityBag.get(cache.serverId)?.index ?? 0;
    const next = current >= state.settings.modes.length ? 1 : current + 1;
    emitNet(EVENTS.setMode, next);
  }

  /** pma-voice `overrideProximityRange(range, disableCycle)`. */
  override(range: unknown, disableCycle: unknown): void {
    if (typeof range !== "number") throw new Error("'range' expected a number");
    emitNet(EVENTS.setRange, range);
    if (disableCycle === true) {
      state.cycleBlocked = true;
      this.blockedByOverride = true;
    }
  }

  /** pma-voice `clearProximityOverride`. */
  clear(): void {
    emitNet(EVENTS.setRange, null);
    if (!this.blockedByOverride) return;
    this.blockedByOverride = false;
    state.cycleBlocked = false;
  }
}

export const proximity = new Proximity();
