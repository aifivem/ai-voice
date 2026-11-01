import type { Backend } from "common/backend";

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
