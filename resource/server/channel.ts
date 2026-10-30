import { ChannelMode, NO_CHANNEL, voiceNatives } from "./natives";

interface Member {
  muted: boolean;
}

/**
 * One Enhanced voice channel that remembers who is in it and who is muted: the natives cannot be queried, and adding
 * a member again resets its muted and deaf state, so a member is never re-added.
 */
export class VoiceChannel {
  private readonly members = new Map<number, Member>();

  private constructor(
    readonly id: number,
    readonly label: string,
  ) {}

  /** 3D: members hear a talker within `maxDistance`. Null when the channel limit is reached. */
  static spatial(maxDistance: number, label: string): VoiceChannel | null {
    return VoiceChannel.create(ChannelMode.Spatial, maxDistance, label);
  }

  /** 2D: every member hears every unmuted member (radio, call). */
  static flat(label: string): VoiceChannel | null {
    return VoiceChannel.create(ChannelMode.NonSpatial, 0, label);
  }

  private static create(
    mode: ChannelMode,
    distance: number,
    label: string,
  ): VoiceChannel | null {
    const id = voiceNatives.create(mode, distance);
    return id >= NO_CHANNEL ? null : new VoiceChannel(id, label);
  }

  get size(): number {
    return this.members.size;
  }

  has(source: number): boolean {
    return this.members.has(source);
  }

  add(source: number, muted: boolean): void {
    const member = this.members.get(source);
    if (member) return this.setMuted(source, muted);
    voiceNatives.add(this.id, source);
    this.members.set(source, { muted: false });
    if (muted) this.setMuted(source, true);
  }

  remove(source: number): void {
    if (!this.members.delete(source)) return;
    voiceNatives.leave(this.id, source);
  }

  setMuted(source: number, muted: boolean): void {
    const member = this.members.get(source);
    if (!member || member.muted === muted) return;
    voiceNatives.mute(this.id, source, muted);
    member.muted = muted;
  }

  /** A player who left: the server already took them out of every channel. */
  forget(source: number): void {
    this.members.delete(source);
  }

  destroy(): void {
    this.members.clear();
    voiceNatives.remove(this.id);
  }

  /** For `voicedebug`. */
  describe(): string {
    const list = [...this.members]
      .map(([s, m]) => `${s}${m.muted ? "m" : ""}`)
      .join(",");
    return `${this.label}#${this.id} [${list}]`;
  }
}
