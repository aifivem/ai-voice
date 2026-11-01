import { cache, player } from "@aicore-fivem/lib/client";
import { PMA } from "common";
import type { Anim } from "common/anim";
import { frequencyOf } from "common/frequency";
import { animOf } from "common/settings";
import { state } from "./state";

/**
 * The talk animation: the frequency span's set from the panel, else the panel's default set; none when the panel's
 * switch is off, in a vehicle when not allowed there, or when a script turned it off for this player.
 */
class RadioAnim {
  /** pma-voice `toggleRadioAnim` / ai-voice `setRadioAnimDisabled`. */
  disabled = false;
  private playing: Anim | null = null;

  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
    emit(PMA.toggleRadioAnim, disabled);
    if (disabled) this.stop();
  }

  /** The animation a frequency would play now (null: none). */
  resolve(channel: number): Anim | null {
    const s = state.settings;
    if (!s.radioAnim || this.disabled) return null;
    if (!s.radioAnimInVehicle && cache.vehicle !== false) return null;
    const span = frequencyOf(state.frequencies.values(), channel);
    return animOf(s, span?.anim || s.radioAnimSet);
  }

  play(channel: number): void {
    const anim = this.resolve(channel);
    if (!anim) return;
    this.playing = anim;
    void player.playAnim(anim.dict, anim.clip, {
      flag: anim.flag,
      blendOut: 2,
    });
  }

  stop(): void {
    if (!this.playing) return;
    StopAnimTask(cache.ped, this.playing.dict, this.playing.clip, -4);
    this.playing = null;
  }
}

export const radioAnim = new RadioAnim();
