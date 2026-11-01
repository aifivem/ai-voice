import { createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { VoiceChannel } from "./channel";

const log = createLogger(ResourceName);

/** The 2D channel of a frequency or call, made on first use; null when the channel limit is reached. */
export function flatChannel(
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

/** Takes a player out of a frequency or call channel; an empty channel is destroyed. */
export function leaveFlatChannel(
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
