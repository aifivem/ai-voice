import type { Backend } from "common/voice";

/** What the server needs to know of a player to place them in channels. */
export interface Talker {
  readonly source: number;
  /** The range they talk at now, metres. */
  readonly distance: number;
  readonly muted: boolean;
}

/**
 * Where the audio goes. The Mumble backend leaves routing to the clients (only the server mute is the server's);
 * the Enhanced backend puts players into server voice channels.
 */
export interface Router {
  readonly backend: Backend;
  join(talker: Talker): void;
  /** The player left; Enhanced already took them out of every channel. */
  forget(source: number): void;
  /** The talker's range or mute changed. */
  update(talker: Talker): void;
  radioJoin(source: number, channel: number): void;
  radioLeave(source: number, channel: number): void;
  radioTalk(source: number, channel: number, talking: boolean): void;
  callJoin(source: number, channel: number): void;
  callLeave(source: number, channel: number): void;
  /** A player standing at a loudspeaker phone hears that call (`talks`: the call hears them too); `on` false ends it. */
  callBystander(
    source: number,
    channel: number,
    on: boolean,
    talks: boolean,
  ): void;
  /** The ranges in the panel changed: place everyone again. */
  rebuild(talkers: Iterable<Talker>): void;
  stop(): void;
  describe(): string[];
}

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
