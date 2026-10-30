import { cache } from "@aicore-fivem/lib/client";
import { waitFor } from "@aicore-fivem/lib/shared";
import { log, proximityBag, state } from "./state";

const TARGET = 1;
/** pma-voice's offset for script channels: above every server id. */
const SCRIPT_CHANNEL_BASE = 65535;

type ProximityCheck = (player: number) => boolean;

/**
 * Legacy voice (pma-voice's model): each client talks in its own Mumble channel (its server id) through voice target
 * 1, re-targeted every 200 ms to the channels of players in range, plus call members always and radio members while
 * push-to-talk is held. `GetActivePlayers` only lists players in scope, so routing buckets separate voice by themselves.
 */
class MumbleVoice {
  private started = false;
  private listening = false;
  private mode: "proximity" | "channel" = "proximity";
  /** This tick's own position and squared target range (read once per tick, not once per player). */
  private x = 0;
  private y = 0;
  private z = 0;
  private range2 = 0;
  private readonly defaultCheck: ProximityCheck = (player) => {
    // One array per player is the native's own return; nothing else is allocated per player.
    const pos = GetEntityCoords(GetPlayerPed(player), false);
    const dx = this.x - (pos[0] ?? 0);
    const dy = this.y - (pos[1] ?? 0);
    const dz = this.z - (pos[2] ?? 0);
    return dx * dx + dy * dy + dz * dz < this.range2;
  };
  private check: ProximityCheck = this.defaultCheck;
  /** The resource that set `check`; its stop brings the default back. */
  private checkOwner = "";

  start(): void {
    if (this.started) return;
    this.started = true;
    on("mumbleConnected", () => void this.joinOwnChannel());
    if (MumbleIsConnected()) void this.joinOwnChannel();
    setInterval(() => this.tick(), 200);
    on("onClientResourceStop", (resource: string) => {
      // A check from a stopped resource would throw on every tick.
      if (resource === this.checkOwner) this.resetCheck();
    });
  }

  distance(): number {
    return proximityBag.get(cache.serverId)?.distance ?? 3;
  }

  /** The talker range followed from the `proximity` bag. */
  applyRange(): void {
    MumbleSetTalkerProximity(this.distance());
  }

  /** pma-voice `overrideProximityCheck(fn(player) -> boolean)`. */
  setCheck(fn: unknown, owner: string): void {
    if (typeof fn !== "function") return this.resetCheck();
    this.check = (player) => Boolean(fn(player));
    this.checkOwner = owner;
  }

  resetCheck(): void {
    this.check = this.defaultCheck;
    this.checkOwner = "";
  }

  /** pma-voice `setVoiceState`: "channel" talks only in a script channel, "proximity" goes back. */
  async setVoiceState(mode: unknown, channel: unknown): Promise<void> {
    if (mode === "channel" && typeof channel === "number") {
      this.mode = "channel";
      const id = channel + SCRIPT_CHANNEL_BASE;
      MumbleSetVoiceChannel(id);
      await waitFor(
        () =>
          MumbleGetVoiceChannelFromServerId(cache.serverId) === id || undefined,
        10_000,
        250,
      ).catch(() => log.warn(`could not join voice channel ${channel}`));
      MumbleAddVoiceTargetChannel(TARGET, id);
    } else if (mode === "proximity") {
      this.mode = "proximity";
      await this.joinOwnChannel();
    }
  }

  /**
   * Who hears this player beyond proximity: call members and loudspeaker targets always, the active frequency while
   * push-to-talk is held, and the players tgiann-phone / tgiann-radio-v2 route to (they add targets themselves; a
   * refresh here would otherwise drop theirs).
   */
  refreshPlayerTargets(): void {
    if (!this.started) return;
    MumbleClearVoiceTargetPlayers(TARGET);
    const added = new Set<number>([cache.serverId]);
    const add = (id: number) => {
      if (added.has(id)) return;
      added.add(id);
      MumbleAddVoiceTargetPlayerByServerId(TARGET, id);
    };
    for (const id of state.call.keys()) add(id);
    for (const id of state.speakerAudio.send) add(id);
    for (const id of state.externalCall) add(id);
    if (state.radioPressed)
      for (const id of state.activeMembers().keys()) add(id);
    if (state.externalRadioPressed)
      for (const id of state.externalRadio) add(id);
  }

  private async joinOwnChannel(): Promise<void> {
    const own = cache.serverId;
    this.applyRange();
    MumbleClearVoiceTarget(TARGET);
    MumbleSetVoiceTarget(TARGET);
    MumbleSetVoiceChannel(own);
    await waitFor(
      () => MumbleGetVoiceChannelFromServerId(own) === own || undefined,
      false,
      250,
    );
    MumbleAddVoiceTargetChannel(TARGET, own);
    this.addNearby();
    this.refreshPlayerTargets();
  }

  private tick(): void {
    if (this.mode !== "proximity" || !MumbleIsConnected()) return;
    this.addNearby();
    const spectating = NetworkIsInSpectatorMode();
    if (spectating !== this.listening) this.listenAll(spectating);
  }

  private addNearby(): void {
    const own = GetEntityCoords(cache.ped, false);
    this.x = own[0] ?? 0;
    this.y = own[1] ?? 0;
    this.z = own[2] ?? 0;
    // Native audio carries further than GTA units: players within this many times the range are targeted.
    const range = this.distance() * state.settings.rangeFactor;
    this.range2 = range * range;
    MumbleClearVoiceTargetChannels(TARGET);
    const players: unknown = GetActivePlayers();
    if (!Array.isArray(players)) return;
    for (const player of players) {
      if (typeof player !== "number" || !this.check(player)) continue;
      MumbleAddVoiceTargetChannel(TARGET, GetPlayerServerId(player));
    }
  }

  /** Spectating admins hear everyone in scope. */
  private listenAll(on: boolean): void {
    this.listening = on;
    const players: unknown = GetActivePlayers();
    if (!Array.isArray(players)) return;
    for (const player of players) {
      if (typeof player !== "number" || player === cache.playerId) continue;
      const id = GetPlayerServerId(player);
      if (on) MumbleAddVoiceChannelListen(id);
      else MumbleRemoveVoiceChannelListen(id);
    }
  }
}

export const mumble = new MumbleVoice();
