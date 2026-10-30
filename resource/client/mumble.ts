import { cache } from "@aicore-fivem/lib/client";
import { waitFor } from "@aicore-fivem/lib/shared";
import { log, proximityBag, state } from "./state";

const TARGET = 1;
/** pma-voice's offset for script channels: above every server id. */
const SCRIPT_CHANNEL_BASE = 65535;
/** Native audio carries sound further than GTA units: pma-voice targets players within 3x the range. */
const NATIVE_AUDIO_FACTOR = 3;

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
  private readonly defaultCheck: ProximityCheck = (player) => {
    const [x = 0, y = 0, z = 0] = GetEntityCoords(cache.ped, false);
    const [tx = 0, ty = 0, tz = 0] = GetEntityCoords(
      GetPlayerPed(player),
      false,
    );
    const range = this.distance() * NATIVE_AUDIO_FACTOR;
    return (x - tx) ** 2 + (y - ty) ** 2 + (z - tz) ** 2 < range * range;
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

  /** Call members always, radio members while push-to-talk is held. */
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
    if (state.radioPressed) for (const id of state.radio.keys()) add(id);
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
