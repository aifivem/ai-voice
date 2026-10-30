import {
  cache,
  Keybind,
  onServerEvent,
  player,
  TickLoop,
} from "@aicore-fivem/lib/client";
import { Locale, PMA } from "common";
import { effects, micClick } from "./effects";
import { isChannelId, isServerId, parseMembers } from "./members";
import { mumble } from "./mumble";
import { backendKey, deadBag, pmaDeadBag, state } from "./state";

const ANIM_DICT = "random@arrests";
const ANIM_CLIP = "generic_radio_enter";
/** INPUT_PUSH_TO_TALK: held by script while the radio key is down, so the game transmits in push-to-talk mode too. */
const PUSH_TO_TALK = 249;

const isMumble = (): boolean => backendKey.get() === "mumble";

/** The radio: frequency membership from the server, push-to-talk, the clicks and the animation. */
class Radio {
  animDisabled = false;
  private readonly holdTalk = new TickLoop(() => {
    SetControlNormal(0, PUSH_TO_TALK, 1);
    SetControlNormal(1, PUSH_TO_TALK, 1);
    SetControlNormal(2, PUSH_TO_TALK, 1);
  });

  start(): void {
    new Keybind({
      name: "voice_radio",
      description: Locale("KEYBIND_RADIO"),
      hintLabel: Locale("KEYBIND_RADIO_HINT"),
      defaultKey: "LMENU",
      onPressed: () => this.press(),
      onReleased: () => this.release(),
    });
    onServerEvent(
      PMA.syncRadioData,
      { args: ([members]) => [parseMembers(members)] },
      (members) => this.sync(members),
    );
    onServerEvent(
      PMA.addPlayerToRadio,
      { args: ([id]) => (isServerId(id) ? [id] : null) },
      (id) => {
        state.radio.set(id, false);
        if (state.radioPressed && isMumble()) mumble.refreshPlayerTargets();
      },
    );
    onServerEvent(
      PMA.removePlayerFromRadio,
      { args: ([id]) => (isServerId(id) ? [id] : null) },
      (id) => this.removeMember(id),
    );
    onServerEvent(
      PMA.setTalkingOnRadio,
      {
        args: ([id, talking]) =>
          isServerId(id) && typeof talking === "boolean" ? [id, talking] : null,
      },
      (id, talking) => {
        if (id === cache.serverId) return;
        state.radio.set(id, talking);
        effects.toggle(id, talking, "radio");
        micClick(talking);
      },
    );
    onServerEvent(
      PMA.clSetPlayerRadio,
      { args: ([channel]) => (isChannelId(channel) ? [channel] : null) },
      (channel) => (state.radioChannel = channel),
    );
  }

  /** pma-voice `setRadioChannel`: 0 leaves. */
  setChannel(channel: number): void {
    if (!state.settings.radio) return;
    emitNet(PMA.setPlayerRadio, channel);
    state.radioChannel = channel;
  }

  private sync(members: Map<number, boolean> | null): void {
    state.radio.clear();
    for (const [id, talking] of members ?? []) {
      state.radio.set(id, talking);
      if (id !== cache.serverId) effects.toggle(id, talking, "radio");
    }
  }

  private removeMember(id: number): void {
    if (id !== cache.serverId) {
      state.radio.delete(id);
      effects.toggle(id, false, "radio");
    } else {
      for (const member of state.radio.keys())
        if (member !== cache.serverId) effects.toggle(member, false, "radio");
      state.radio.clear();
      state.radioChannel = 0;
      if (state.radioPressed) this.release();
    }
    if (state.radioPressed && isMumble()) mumble.refreshPlayerTargets();
  }

  private canTalk(): boolean {
    return (
      state.settings.radio &&
      state.radioEnabled &&
      state.radioDisableBits === 0 &&
      state.radioChannel > 0 &&
      deadBag.get(cache.serverId) !== true &&
      pmaDeadBag.get(cache.serverId) !== true &&
      !IsPlayerDead(cache.playerId)
    );
  }

  private press(): void {
    if (state.radioPressed || !this.canTalk()) return;
    state.radioPressed = true;
    if (isMumble()) mumble.refreshPlayerTargets();
    emitNet(PMA.setTalkingOnRadio, true);
    micClick(true);
    this.holdTalk.set(true);
    emit(PMA.radioActive, true);
    if (
      state.settings.radioAnim &&
      !this.animDisabled &&
      (state.settings.radioAnimInVehicle || cache.vehicle === false)
    )
      void player.playAnim(ANIM_DICT, ANIM_CLIP, { flag: 50, blendOut: 2 });
  }

  private release(): void {
    if (!state.radioPressed) return;
    state.radioPressed = false;
    this.holdTalk.set(false);
    if (isMumble()) mumble.refreshPlayerTargets();
    emit(PMA.radioActive, false);
    micClick(false);
    if (state.settings.radioAnim)
      StopAnimTask(cache.ped, ANIM_DICT, ANIM_CLIP, -4);
    emitNet(PMA.setTalkingOnRadio, false);
  }
}

export const radio = new Radio();
