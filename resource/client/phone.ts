import { cache, onServerEvent } from "@aicore-fivem/lib/client";
import { isRecord } from "@aicore-fivem/lib/shared";
import { EVENTS, EXTERNAL, PMA } from "common";
import { effects } from "./effects";
import { isChannelId, isServerId, parseMembers } from "./members";
import { mumble } from "./mumble";
import { backendKey, speakerBag, state, type SpeakerAudio } from "./state";

const ids = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((id): id is number => isServerId(id)) : [];

const toAudio = (v: unknown): SpeakerAudio | null =>
  isRecord(v)
    ? { send: ids(v.send), call: ids(v.call), speaker: ids(v.speaker) }
    : null;

/** Phone calls: everyone in the call hears everyone; a loudspeaker lets players nearby join in. */
class Phone {
  start(): void {
    onServerEvent(
      PMA.syncCallData,
      { args: ([members]) => [parseMembers(members)] },
      (members) => {
        state.call.clear();
        for (const id of members?.keys() ?? []) this.add(id);
        this.retarget();
      },
    );
    onServerEvent(
      PMA.addPlayerToCall,
      { args: ([id]) => (isServerId(id) ? [id] : null) },
      (id) => {
        this.add(id);
        this.retarget();
      },
    );
    onServerEvent(
      PMA.removePlayerFromCall,
      { args: ([id]) => (isServerId(id) ? [id] : null) },
      (id) => this.remove(id),
    );
    onServerEvent(
      PMA.clSetPlayerCall,
      { args: ([channel]) => (isChannelId(channel) ? [channel] : null) },
      (channel) => (state.callChannel = channel),
    );
    onServerEvent(
      EVENTS.callAudio,
      { args: ([audio]) => [toAudio(audio)] },
      (audio) => this.setSpeakerAudio(audio),
    );
    // tgiann-phone routes call audio itself: the players it names stay in the voice target.
    on(EXTERNAL.callTargets, (targets: unknown) => {
      state.externalCall.clear();
      if (isRecord(targets))
        for (const key of Object.keys(targets)) {
          const id = Number(key);
          if (isServerId(id)) state.externalCall.add(id);
        }
      this.retarget();
    });
  }

  /** pma-voice `setCallChannel`: 0 hangs up. The server refuses joins no phone script allowed. */
  setChannel(channel: number): void {
    if (!state.settings.phone) return;
    emitNet(PMA.setPlayerCall, channel);
    state.callChannel = channel;
  }

  /** The loudspeaker of this player's phone (only during a call). */
  setSpeaker(on: boolean): void {
    emitNet(EVENTS.setSpeaker, on);
  }

  speaker(): boolean {
    return speakerBag.get(cache.serverId) === true;
  }

  private add(id: number): void {
    state.call.set(id, false);
    if (id !== cache.serverId) effects.toggle(id, true, "phone");
  }

  private remove(id: number): void {
    if (id === cache.serverId) {
      const others = [...state.call.keys()].filter((m) => m !== id);
      state.call.clear();
      state.callChannel = 0;
      for (const member of others) effects.toggle(member, false, "phone");
    } else {
      state.call.delete(id);
      effects.toggle(id, false, "phone");
    }
    this.retarget();
  }

  /** What a loudspeaker adds: players heard as a call, players heard through a speaker, players to reach. */
  private setSpeakerAudio(next: SpeakerAudio | null): void {
    const audio = next ?? { send: [], call: [], speaker: [] };
    const old = state.speakerAudio;
    const heard = new Set([...audio.call, ...audio.speaker]);
    for (const id of [...old.call, ...old.speaker])
      if (!heard.has(id) && !state.call.has(id))
        effects.toggle(id, false, "phone");
    for (const id of audio.call) effects.toggle(id, true, "phone");
    for (const id of audio.speaker) effects.toggle(id, true, "speaker");
    state.speakerAudio = audio;
    this.retarget();
  }

  private retarget(): void {
    if (backendKey.get() === "mumble") mumble.refreshPlayerTargets();
  }
}

export const phone = new Phone();

phone.start();
