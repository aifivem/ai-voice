import { notify } from "@aicore-fivem/lib/server";
import { Locale, PMA } from "common";
import { checks } from "./checks";
import { content } from "./content";
import { callBag, radioBag, type Players, type VoicePlayer } from "./players";
import type { Router } from "./router";

/** Members of one channel: server id -> talking on it (calls keep false). */
type Members = Map<number, boolean>;

/** pma-voice's member table as an object (msgpack keys arrive as strings; clients read them with Number()). */
const table = (members: Members): Record<string, boolean> =>
  Object.fromEntries(members);

/**
 * Radio frequencies and phone calls: who is on which, with pma-voice's events so third-party radio and phone UIs
 * keep working. A player hears every frequency they joined and talks on the active one (pma's single radio is the
 * active one). Snapshot (`syncRadioData` / `syncCallData`) to the one joining, deltas only to that channel's members;
 * radio events carry the frequency as an extra last argument.
 */
export class Groups {
  private readonly radios = new Map<number, Members>();
  private readonly calls = new Map<number, Members>();
  private readonly callListeners: Array<(source: number, old: number) => void> =
    [];

  constructor(
    private readonly players: Players,
    private readonly router: Router,
  ) {}

  /** pma-voice `setPlayerRadio`: the active frequency (replaces the old active one); 0 leaves every frequency. */
  setRadio(source: number, channel: number): void {
    const player = this.players.get(source);
    if (!player || !content.settings.radio) return;
    if (channel === 0) {
      for (const ch of player.radios) this.leaveRadio(player, ch);
      return this.activate(player, 0);
    }
    if (player.radios.has(channel)) return this.activate(player, channel);
    if (!checks.canJoinRadio(source, channel)) return this.refuse(player);
    if (player.radio !== 0) this.leaveRadio(player, player.radio);
    this.joinRadio(player, channel);
    this.activate(player, channel);
  }

  /** Hear one more frequency without talking on it (up to the panel's limit), or leave one. */
  listen(source: number, channel: number, on: boolean): boolean {
    const player = this.players.get(source);
    if (!player || !content.settings.radio || channel === 0) return false;
    if (!on) {
      if (!player.radios.has(channel)) return false;
      this.leaveRadio(player, channel);
      if (player.radio === channel)
        this.activate(player, player.radios.values().next().value ?? 0);
      return true;
    }
    if (player.radios.has(channel)) return true;
    if (player.radios.size >= content.settings.maxRadioChannels) return false;
    if (!checks.canJoinRadio(source, channel)) return false;
    this.joinRadio(player, channel);
    if (player.radio === 0) this.activate(player, channel);
    return true;
  }

  /** Talk on another frequency the player already hears. */
  setActive(source: number, channel: number): boolean {
    const player = this.players.get(source);
    if (!player?.radios.has(channel)) return false;
    this.activate(player, channel);
    return true;
  }

  setRadioTalking(source: number, talking: boolean): void {
    const channel = this.players.get(source)?.radio ?? 0;
    const members = this.radios.get(channel);
    if (!members?.has(source) || members.get(source) === talking) return;
    members.set(source, talking);
    for (const member of members.keys())
      if (member !== source)
        emitNet(PMA.setTalkingOnRadio, member, source, talking, channel);
    this.router.radioTalk(source, channel, talking);
  }

  /** pma-voice `setPlayerCall`; 0 hangs up. */
  setCall(source: number, channel: number, fromScript: boolean): void {
    const player = this.players.get(source);
    if (!player || !content.settings.phone) return;
    if (fromScript) emitNet(PMA.clSetPlayerCall, source, channel);
    if (player.call === channel) return;
    const old = player.call;
    if (old !== 0) this.leaveCall(source, old);
    player.call = channel;
    if (channel !== 0) this.joinCall(source, channel);
    callBag.set(source, channel);
    for (const listener of this.callListeners) listener(source, old);
  }

  /** A call request the server refused: the client forgets it. */
  refuseCall(source: number): void {
    emitNet(PMA.removePlayerFromCall, source, source);
  }

  onCallChange(listener: (source: number, old: number) => void): void {
    this.callListeners.push(listener);
  }

  /** Members of a call (empty when none). */
  callMembers(channel: number): ReadonlyMap<number, boolean> {
    return this.calls.get(channel) ?? new Map();
  }

  /** pma-voice `getPlayersInRadioChannel`: `{ [source]: talking }`. */
  radioMembers(channel: number): Record<string, boolean> {
    const members = this.radios.get(channel);
    return members ? table(members) : {};
  }

  /** Jobs or duty changed: leave the frequencies the panel no longer allows. */
  recheck(source: number): void {
    const player = this.players.get(source);
    if (!player) return;
    let left = false;
    for (const channel of player.radios) {
      if (checks.jobAllows(source, channel)) continue;
      left = true;
      this.listen(source, channel, false);
    }
    if (left) notify(source, Locale("NOTIFY_RADIO_REVOKED"), "error");
  }

  /** The player left: tell the members of their frequencies and call. */
  drop(source: number): void {
    const player = this.players.get(source);
    if (!player) return;
    for (const channel of player.radios) this.leaveRadio(player, channel);
    if (player.call !== 0) this.leaveCall(source, player.call);
  }

  describe(): string[] {
    const line = (kind: string, map: Map<number, Members>) =>
      [...map].map(([id, m]) => `${kind} ${id}: ${[...m.keys()].join(",")}`);
    return [...line("radio", this.radios), ...line("call", this.calls)];
  }

  /** The frequency push-to-talk sends on; the client is always told (it never guesses). */
  private activate(player: VoicePlayer, channel: number): void {
    if (player.radio !== channel) {
      this.setRadioTalking(player.source, false);
      player.radio = channel;
    }
    emitNet(PMA.clSetPlayerRadio, player.source, channel);
    radioBag.set(player.source, channel);
  }

  private refuse(player: VoicePlayer): void {
    emitNet(PMA.removePlayerFromRadio, player.source, player.source, 0);
    notify(player.source, Locale("NOTIFY_RADIO_DENIED"), "error");
    radioBag.set(player.source, player.radio);
  }

  private joinRadio(player: VoicePlayer, channel: number): void {
    let members = this.radios.get(channel);
    if (!members) this.radios.set(channel, (members = new Map()));
    const source = player.source;
    const name = content.settings.syncNames ? checks.radioName(source) : false;
    for (const member of members.keys())
      emitNet(PMA.addPlayerToRadio, member, source, name, channel);
    members.set(source, false);
    player.radios.add(channel);
    emitNet(PMA.syncRadioData, source, table(members), name, channel);
    this.router.radioJoin(source, channel);
  }

  private leaveRadio(player: VoicePlayer, channel: number): void {
    const members = this.radios.get(channel);
    player.radios.delete(channel);
    if (!members) return;
    if (player.radio === channel) this.setRadioTalking(player.source, false);
    for (const member of members.keys())
      emitNet(PMA.removePlayerFromRadio, member, player.source, channel);
    members.delete(player.source);
    if (members.size === 0) this.radios.delete(channel);
    this.router.radioLeave(player.source, channel);
  }

  private joinCall(source: number, channel: number): void {
    let members = this.calls.get(channel);
    if (!members) this.calls.set(channel, (members = new Map()));
    for (const member of members.keys())
      emitNet(PMA.addPlayerToCall, member, source);
    members.set(source, false);
    emitNet(PMA.syncCallData, source, table(members));
    this.router.callJoin(source, channel);
  }

  private leaveCall(source: number, channel: number): void {
    const members = this.calls.get(channel);
    if (!members) return;
    for (const member of members.keys())
      emitNet(PMA.removePlayerFromCall, member, source);
    members.delete(source);
    if (members.size === 0) this.calls.delete(channel);
    this.router.callLeave(source, channel);
  }
}
