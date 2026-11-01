import {
  cache,
  Keybind,
  medical,
  onServerEvent,
  TickLoop,
} from "@aicore-fivem/lib/client";
import { EVENTS, Locale, PMA } from "common";
import { radioAnim } from "./anim";
import { effects, micClick } from "./effects";
import { isChannelId, isServerId, parseMembers } from "./members";
import { retarget } from "./retarget";
import { deadBag, pmaDeadBag, state } from "./state";

/** INPUT_PUSH_TO_TALK: held by script while the radio key is down, so the game transmits in push-to-talk mode too. */
const PUSH_TO_TALK = 249;

/** The radio: membership of every joined frequency from the server, push-to-talk on the active one, clicks, animation. */
class Radio {
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
      defaultKey: GetConvar("voice_defaultRadio", "LMENU"),
      onPressed: () => this.press(),
      onReleased: () => this.release(),
    });
    onServerEvent(
      PMA.syncRadioData,
      {
        args: ([members, , channel]) =>
          isChannelId(channel) ? [parseMembers(members), channel] : null,
      },
      (members, channel) => this.sync(channel, members),
    );
    onServerEvent(
      PMA.addPlayerToRadio,
      {
        args: ([id, , channel]) =>
          isServerId(id) && isChannelId(channel) ? [id, channel] : null,
      },
      (id, channel) => {
        this.members(channel).set(id, false);
        if (state.radioPressed && channel === state.radioChannel) retarget();
      },
    );
    onServerEvent(
      PMA.removePlayerFromRadio,
      {
        args: ([id, channel]) =>
          isServerId(id) ? [id, isChannelId(channel) ? channel : 0] : null,
      },
      (id, channel) => this.removeMember(id, channel),
    );
    onServerEvent(
      PMA.setTalkingOnRadio,
      {
        args: ([id, talking, channel]) =>
          isServerId(id) && typeof talking === "boolean"
            ? [id, talking, isChannelId(channel) ? channel : 0]
            : null,
      },
      (id, talking, channel) => {
        if (id === cache.serverId) return;
        this.radios(channel)?.set(id, talking);
        effects.toggle(id, talking, "radio");
        micClick(talking);
      },
    );
    onServerEvent(
      PMA.clSetPlayerRadio,
      { args: ([channel]) => (isChannelId(channel) ? [channel] : null) },
      (channel) => {
        if (channel !== state.radioChannel && state.radioPressed)
          this.release();
        state.radioChannel = channel;
      },
    );
  }

  /** pma-voice `setRadioChannel`: the active frequency; 0 leaves every frequency. The server answers with the result. */
  setChannel(channel: number): void {
    if (state.settings.radio) emitNet(PMA.setPlayerRadio, channel);
  }

  /** Hear one more frequency (the panel limits how many), or leave one. */
  listen(channel: number, on: boolean): void {
    if (state.settings.radio) emitNet(EVENTS.radioListen, channel, on);
  }

  /** Talk on another joined frequency. */
  setActive(channel: number): void {
    if (state.radios.has(channel)) emitNet(EVENTS.radioActive, channel);
  }

  private radios(channel: number): Map<number, boolean> | undefined {
    return state.radios.get(channel);
  }

  private members(channel: number): Map<number, boolean> {
    let members = state.radios.get(channel);
    if (!members) state.radios.set(channel, (members = new Map()));
    return members;
  }

  private sync(channel: number, members: Map<number, boolean> | null): void {
    const list = this.members(channel);
    list.clear();
    for (const [id, talking] of members ?? []) {
      list.set(id, talking);
      if (id !== cache.serverId && talking) effects.toggle(id, true, "radio");
    }
  }

  private removeMember(id: number, channel: number): void {
    if (id !== cache.serverId) {
      this.radios(channel)?.delete(id);
      if (!state.onAnyRadio(id)) effects.toggle(id, false, "radio");
    } else if (channel !== 0) {
      // This player left the frequency (0: a refused join, nothing was joined).
      const members = this.radios(channel);
      state.radios.delete(channel);
      for (const member of members?.keys() ?? [])
        if (member !== id && !state.onAnyRadio(member))
          effects.toggle(member, false, "radio");
      if (channel === state.radioChannel && state.radioPressed) this.release();
    }
    if (state.radioPressed) retarget();
  }

  private canTalk(): boolean {
    return (
      state.settings.radio &&
      state.radioEnabled &&
      state.radioDisableBits === 0 &&
      state.radioChannel > 0 &&
      deadBag.get(cache.serverId) !== true &&
      pmaDeadBag.get(cache.serverId) !== true &&
      !medical.isDead()
    );
  }

  private press(): void {
    if (state.radioPressed || !this.canTalk()) return;
    state.radioPressed = true;
    retarget();
    emitNet(PMA.setTalkingOnRadio, true);
    micClick(true);
    this.holdTalk.set(true);
    emit(PMA.radioActive, true);
    radioAnim.play(state.radioChannel);
  }

  private release(): void {
    if (!state.radioPressed) return;
    state.radioPressed = false;
    this.holdTalk.set(false);
    retarget();
    emit(PMA.radioActive, false);
    micClick(false);
    radioAnim.stop();
    emitNet(PMA.setTalkingOnRadio, false);
  }
}

export const radio = new Radio();

radio.start();
