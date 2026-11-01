import { PMA } from "common";
import type { Router } from "../routing/router";
import { describeMembers, table, type Members } from "./members";

/** Every phone call's members, with pma-voice's call events: a snapshot to the one joining, deltas to the members. */
export class CallMembers {
  private readonly calls = new Map<number, Members>();

  constructor(private readonly router: Router) {}

  /** Members of a call (empty when none). */
  members(channel: number): ReadonlyMap<number, boolean> {
    return this.calls.get(channel) ?? new Map();
  }

  join(source: number, channel: number): void {
    let members = this.calls.get(channel);
    if (!members) this.calls.set(channel, (members = new Map()));
    for (const member of members.keys())
      emitNet(PMA.addPlayerToCall, member, source);
    members.set(source, false);
    emitNet(PMA.syncCallData, source, table(members));
    this.router.callJoin(source, channel);
  }

  leave(source: number, channel: number): void {
    const members = this.calls.get(channel);
    if (!members) return;
    for (const member of members.keys())
      emitNet(PMA.removePlayerFromCall, member, source);
    members.delete(source);
    if (members.size === 0) this.calls.delete(channel);
    this.router.callLeave(source, channel);
  }

  describe(): string[] {
    return describeMembers("call", this.calls);
  }
}
