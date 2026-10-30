import { PMA } from "common/voice";
import { checks } from "./checks";
import { content } from "./content";
import { callBag, radioBag, type Players } from "./players";
import type { Router } from "./router";

/** Members of one channel: server id -> talking on it (calls keep false). */
type Members = Map<number, boolean>;

/** pma-voice's member table as an object (msgpack keys arrive as strings; clients read them with Number()). */
const table = (members: Members): Record<string, boolean> =>
  Object.fromEntries(members);

/**
 * Radio frequencies and phone calls: who is on which, with pma-voice's events so third-party radio and phone UIs
 * keep working. Snapshot (`syncRadioData` / `syncCallData`) to the one joining, deltas only to that channel's members.
 */
export class Groups {
  private readonly radios = new Map<number, Members>();
  private readonly calls = new Map<number, Members>();

  constructor(
    private readonly players: Players,
    private readonly router: Router,
  ) {}

  /** pma-voice `setPlayerRadio`: 0 leaves; `fromScript` also tells the client (its own request already knows). */
  setRadio(source: number, channel: number, fromScript: boolean): void {
    const player = this.players.get(source);
    if (!player || !content.settings.radio) return;
    if (fromScript) emitNet(PMA.clSetPlayerRadio, source, channel);
    if (player.radio === channel) return;
    if (player.radio !== 0) this.leaveRadio(source, player.radio);
    player.radio = 0;
    if (channel !== 0) {
      if (!checks.canJoinRadio(source, channel)) {
        emitNet(PMA.removePlayerFromRadio, source, source);
        radioBag.set(source, 0);
        return;
      }
      this.joinRadio(source, channel);
      player.radio = channel;
    }
    radioBag.set(source, player.radio);
  }

  setRadioTalking(source: number, talking: boolean): void {
    const channel = this.players.get(source)?.radio ?? 0;
    const members = this.radios.get(channel);
    if (!members?.has(source) || members.get(source) === talking) return;
    members.set(source, talking);
    for (const member of members.keys())
      if (member !== source)
        emitNet(PMA.setTalkingOnRadio, member, source, talking);
    this.router.radioTalk(source, channel, talking);
  }

  setCall(source: number, channel: number, fromScript: boolean): void {
    const player = this.players.get(source);
    if (!player || !content.settings.phone) return;
    if (fromScript) emitNet(PMA.clSetPlayerCall, source, channel);
    if (player.call === channel) return;
    if (player.call !== 0) this.leaveCall(source, player.call);
    player.call = channel;
    if (channel !== 0) this.joinCall(source, channel);
    callBag.set(source, channel);
  }

  /** pma-voice `getPlayersInRadioChannel`: `{ [source]: talking }`. */
  radioMembers(channel: number): Record<string, boolean> {
    const members = this.radios.get(channel);
    return members ? table(members) : {};
  }

  /** The player left: tell the members of their radio and call. */
  drop(source: number): void {
    const player = this.players.get(source);
    if (!player) return;
    if (player.radio !== 0) this.leaveRadio(source, player.radio);
    if (player.call !== 0) this.leaveCall(source, player.call);
  }

  describe(): string[] {
    const line = (kind: string, map: Map<number, Members>) =>
      [...map].map(([id, m]) => `${kind} ${id}: ${[...m.keys()].join(",")}`);
    return [...line("radio", this.radios), ...line("call", this.calls)];
  }

  private joinRadio(source: number, channel: number): void {
    let members = this.radios.get(channel);
    if (!members) this.radios.set(channel, (members = new Map()));
    const name = content.settings.syncNames ? checks.radioName(source) : false;
    for (const member of members.keys())
      emitNet(PMA.addPlayerToRadio, member, source, name);
    members.set(source, false);
    emitNet(PMA.syncRadioData, source, table(members), name);
    this.router.radioJoin(source, channel);
  }

  private leaveRadio(source: number, channel: number): void {
    const members = this.radios.get(channel);
    if (!members) return;
    for (const member of members.keys())
      emitNet(PMA.removePlayerFromRadio, member, source);
    members.delete(source);
    if (members.size === 0) this.radios.delete(channel);
    this.router.radioLeave(source, channel);
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
