import { createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { VoiceChannel } from "./channel";
import type { Talker } from "./router";

const log = createLogger(ResourceName);

/** One routing bucket's proximity: a spatial channel per range in use, and who is in the bucket. */
export class Bucket {
  readonly channels = new Map<number, VoiceChannel>();
  readonly talkers = new Map<number, Talker>();

  /** The bucket's channel of a range; a new one takes every player of the bucket in, muted. */
  channel(distance: number): void {
    if (this.channels.has(distance)) return;
    const channel = VoiceChannel.spatial(distance, `proximity ${distance}m`);
    if (!channel) return log.error("voice channel limit reached");
    this.channels.set(distance, channel);
    for (const talker of this.talkers.values())
      channel.add(talker.source, talker.muted || talker.distance !== distance);
  }

  /** Drops channels of custom ranges nobody talks at (`modeDistances`: the panel's ranges, kept while empty). */
  pruneChannels(modeDistances: readonly number[]): void {
    const keep = new Set(modeDistances);
    for (const talker of this.talkers.values()) keep.add(talker.distance);
    for (const [distance, channel] of this.channels) {
      if (keep.has(distance)) continue;
      channel.destroy();
      this.channels.delete(distance);
    }
  }
}
