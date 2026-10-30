import { cache, onServerEvent } from "@aicore-fivem/lib/client";
import { PMA } from "common";
import { effects } from "./effects";
import { isChannelId, isServerId, parseMembers } from "./members";
import { mumble } from "./mumble";
import { backendKey, state } from "./state";

/** Phone calls: everyone in the call hears everyone, wherever they are. */
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
  }

  /** pma-voice `setCallChannel`: 0 hangs up. */
  setChannel(channel: number): void {
    if (!state.settings.phone) return;
    emitNet(PMA.setPlayerCall, channel);
    state.callChannel = channel;
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

  private retarget(): void {
    if (backendKey.get() === "mumble") mumble.refreshPlayerTargets();
  }
}

export const phone = new Phone();
