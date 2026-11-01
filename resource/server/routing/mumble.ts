import type { Router, Talker } from "./router";

/** Legacy: clients route through Mumble; the server only mutes. */
export class MumbleRouter implements Router {
  readonly backend = "mumble";
  private readonly muted = new Set<number>();

  constructor() {
    // Native audio carries the radio / phone effects; sending range only keeps players who join Mumble directly from
    // talking to everyone (pma-voice sets both the same way when none is set).
    SetConvarReplicated("voice_useNativeAudio", "true");
    SetConvarReplicated("voice_useSendingRangeOnly", "true");
  }

  join(talker: Talker): void {
    this.update(talker);
  }

  forget(source: number): void {
    this.muted.delete(source);
  }

  update(talker: Talker): void {
    if (talker.muted === this.muted.has(talker.source)) return;
    if (talker.muted) this.muted.add(talker.source);
    else this.muted.delete(talker.source);
    MumbleSetPlayerMuted(talker.source, talker.muted);
  }

  radioJoin(): void {}
  radioLeave(): void {}
  radioTalk(): void {}
  callJoin(): void {}
  callLeave(): void {}
  callBystander(): void {}
  rebuild(): void {}

  stop(): void {
    for (const source of this.muted) MumbleSetPlayerMuted(source, false);
    this.muted.clear();
  }

  describe(): string[] {
    return [`server-muted: ${[...this.muted].join(",") || "none"}`];
  }
}
