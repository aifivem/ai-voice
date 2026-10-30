import { every, type Job } from "@aicore-fivem/lib/server";
import { createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { VoiceChannel } from "./channel";
import type { Router, Talker } from "./router";

const log = createLogger(ResourceName);

/** One routing bucket's proximity: a spatial channel per range in use, and who is in the bucket. */
class Bucket {
  readonly channels = new Map<number, VoiceChannel>();
  readonly talkers = new Map<number, Talker>();
}

/**
 * FiveM for GTAV Enhanced: the server routes all audio.
 * - Proximity: per routing bucket one spatial channel per range; every player is in all of their bucket's channels and
 *   unmuted only in the one of their range, so they hear everyone and are heard at their own range.
 * - Radio: a 2D channel per frequency, members muted until push-to-talk. Calls: a 2D channel per call, unmuted.
 * FiveM has no routing bucket event, so a 1 s job moves players whose bucket changed.
 */
export class EnhancedRouter implements Router {
  readonly backend = "enhanced";
  private readonly buckets = new Map<number, Bucket>();
  /** The bucket each player's proximity channels belong to. */
  private readonly bucketOf = new Map<number, number>();
  private readonly radios = new Map<number, VoiceChannel>();
  private readonly calls = new Map<number, VoiceChannel>();
  private readonly timer: Job;

  /** `modeDistances`: the panel's ranges, whose channels stay while empty. */
  constructor(private readonly modeDistances: () => readonly number[]) {
    this.timer = every(1000, () => this.watchBuckets(), {
      name: "voiceBuckets",
    });
  }

  join(talker: Talker): void {
    const bucketId = GetPlayerRoutingBucket(String(talker.source));
    this.bucketOf.set(talker.source, bucketId);
    const bucket = this.bucket(bucketId);
    bucket.talkers.set(talker.source, talker);
    this.channel(bucket, talker.distance);
    for (const [distance, channel] of bucket.channels)
      channel.add(talker.source, talker.muted || distance !== talker.distance);
  }

  forget(source: number): void {
    const bucketId = this.bucketOf.get(source);
    this.bucketOf.delete(source);
    for (const channel of this.radios.values()) channel.forget(source);
    for (const channel of this.calls.values()) channel.forget(source);
    if (bucketId === undefined) return;
    const bucket = this.buckets.get(bucketId);
    if (!bucket) return;
    bucket.talkers.delete(source);
    for (const channel of bucket.channels.values()) channel.forget(source);
    this.prune(bucketId, bucket);
  }

  update(talker: Talker): void {
    const bucketId = this.bucketOf.get(talker.source);
    const bucket = bucketId === undefined ? null : this.buckets.get(bucketId);
    if (bucketId === undefined || !bucket) return this.join(talker);
    bucket.talkers.set(talker.source, talker);
    this.channel(bucket, talker.distance);
    for (const [distance, channel] of bucket.channels)
      channel.setMuted(
        talker.source,
        talker.muted || distance !== talker.distance,
      );
    for (const channel of this.calls.values())
      channel.setMuted(talker.source, talker.muted);
    if (talker.muted)
      for (const channel of this.radios.values())
        channel.setMuted(talker.source, true);
    this.prune(bucketId, bucket);
  }

  radioJoin(source: number, channel: number): void {
    this.group(this.radios, channel, "radio")?.add(source, true);
  }

  radioLeave(source: number, channel: number): void {
    this.leaveGroup(this.radios, channel, source);
  }

  radioTalk(source: number, channel: number, talking: boolean): void {
    const muted = this.bucketTalker(source)?.muted ?? false;
    this.radios.get(channel)?.setMuted(source, muted || !talking);
  }

  callJoin(source: number, channel: number): void {
    const muted = this.bucketTalker(source)?.muted ?? false;
    this.group(this.calls, channel, "call")?.add(source, muted);
  }

  callLeave(source: number, channel: number): void {
    this.leaveGroup(this.calls, channel, source);
  }

  callBystander(
    source: number,
    channel: number,
    on: boolean,
    talks: boolean,
  ): void {
    const call = this.calls.get(channel);
    if (!call) return;
    if (!on) return call.remove(source);
    const muted = this.bucketTalker(source)?.muted ?? false;
    call.add(source, muted || !talks);
  }

  rebuild(talkers: Iterable<Talker>): void {
    for (const bucket of this.buckets.values())
      for (const channel of bucket.channels.values()) channel.destroy();
    this.buckets.clear();
    this.bucketOf.clear();
    for (const talker of talkers) this.join(talker);
  }

  stop(): void {
    this.timer.stop();
    for (const bucket of this.buckets.values())
      for (const channel of bucket.channels.values()) channel.destroy();
    for (const channel of this.radios.values()) channel.destroy();
    for (const channel of this.calls.values()) channel.destroy();
    this.buckets.clear();
    this.radios.clear();
    this.calls.clear();
  }

  describe(): string[] {
    const lines: string[] = [];
    for (const [id, bucket] of this.buckets)
      for (const channel of bucket.channels.values())
        lines.push(`bucket ${id}: ${channel.describe()}`);
    for (const channel of this.radios.values()) lines.push(channel.describe());
    for (const channel of this.calls.values()) lines.push(channel.describe());
    return lines;
  }

  private bucket(id: number): Bucket {
    let bucket = this.buckets.get(id);
    if (!bucket) this.buckets.set(id, (bucket = new Bucket()));
    return bucket;
  }

  private bucketTalker(source: number): Talker | undefined {
    const id = this.bucketOf.get(source);
    return id === undefined
      ? undefined
      : this.buckets.get(id)?.talkers.get(source);
  }

  /** The bucket's channel of a range; a new one takes every player of the bucket in, muted. */
  private channel(bucket: Bucket, distance: number): void {
    if (bucket.channels.has(distance)) return;
    const channel = VoiceChannel.spatial(distance, `proximity ${distance}m`);
    if (!channel) return log.error("voice channel limit reached");
    bucket.channels.set(distance, channel);
    for (const talker of bucket.talkers.values())
      channel.add(talker.source, talker.muted || talker.distance !== distance);
  }

  /** Drops channels of custom ranges nobody talks at, and empty buckets. */
  private prune(id: number, bucket: Bucket): void {
    if (bucket.talkers.size === 0) {
      for (const channel of bucket.channels.values()) channel.destroy();
      this.buckets.delete(id);
      return;
    }
    const keep = new Set(this.modeDistances());
    for (const talker of bucket.talkers.values()) keep.add(talker.distance);
    for (const [distance, channel] of bucket.channels) {
      if (keep.has(distance)) continue;
      channel.destroy();
      bucket.channels.delete(distance);
    }
  }

  private group(
    map: Map<number, VoiceChannel>,
    id: number,
    kind: string,
  ): VoiceChannel | null {
    let channel = map.get(id) ?? null;
    if (channel) return channel;
    channel = VoiceChannel.flat(`${kind} ${id}`);
    if (!channel) {
      log.error("voice channel limit reached");
      return null;
    }
    map.set(id, channel);
    return channel;
  }

  private leaveGroup(
    map: Map<number, VoiceChannel>,
    id: number,
    source: number,
  ): void {
    const channel = map.get(id);
    if (!channel) return;
    channel.remove(source);
    if (channel.size > 0) return;
    channel.destroy();
    map.delete(id);
  }

  private watchBuckets(): void {
    for (const [source, id] of this.bucketOf) {
      const now = GetPlayerRoutingBucket(String(source));
      if (now === id) continue;
      const talker = this.bucketTalker(source);
      const old = this.buckets.get(id);
      if (old && talker) {
        old.talkers.delete(source);
        for (const channel of old.channels.values()) channel.remove(source);
        this.prune(id, old);
      }
      if (talker) this.join(talker);
    }
  }
}
