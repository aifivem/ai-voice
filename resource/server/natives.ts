/**
 * The server voice API of FiveM for GTAV Enhanced. The natives are in neither @citizenfx/server nor the native
 * database, so they are called by hash (CFX native hashes are the joaat of the upper-case name).
 */

const HASH = {
  create: "0x7A70A736", // CREATE_VOICE_CHANNEL(int mode, float maxDistance) -> int
  remove: "0x0D3A0512", // DELETE_VOICE_CHANNEL(int channel)
  add: "0xEA8CA2F5", // ADD_PLAYER_TO_VOICE_CHANNEL(int channel, int client)
  leave: "0xDB325A2D", // REMOVE_PLAYER_FROM_VOICE_CHANNEL(int channel, int client)
  mute: "0x2A1DEA36", // SET_PLAYER_MUTED_IN_VOICE_CHANNEL(int channel, int client, bool muted)
  deaf: "0x3469B8AC", // SET_PLAYER_DEAF_IN_VOICE_CHANNEL(int channel, int client, bool deaf)
} as const;

/** `CreateVoiceChannel` answers this when the 65535 channels are used up. */
export const NO_CHANNEL = 65535;

export const enum ChannelMode {
  /** 2D, receivers by membership. */
  NonSpatial = 0,
  /** 3D, receivers within maxDistance. */
  Spatial = 1,
}

/** FiveM's own wrappers pass floats like this: an integral number would arrive as an int. */
const float = (value: number): number =>
  value === 0 ? value : value + 0.0000001;

export const voiceNatives = {
  create: (mode: ChannelMode, maxDistance: number): number =>
    Citizen.invokeNative<number>(
      HASH.create,
      mode,
      float(maxDistance),
      Citizen.resultAsInteger(),
    ),
  remove: (channel: number): void => Citizen.invokeNative(HASH.remove, channel),
  add: (channel: number, source: number): void =>
    Citizen.invokeNative(HASH.add, channel, source),
  leave: (channel: number, source: number): void =>
    Citizen.invokeNative(HASH.leave, channel, source),
  mute: (channel: number, source: number, muted: boolean): void =>
    Citizen.invokeNative(HASH.mute, channel, source, muted),
  deaf: (channel: number, source: number, deaf: boolean): void =>
    Citizen.invokeNative(HASH.deaf, channel, source, deaf),
};

/**
 * Whether this server has the Enhanced voice API: two channels must come back with distinct ids below the limit
 * (a Legacy server throws on the unknown hash, or would answer the same nothing twice).
 */
export function hasEnhancedVoice(): boolean {
  try {
    const a = voiceNatives.create(ChannelMode.NonSpatial, 0);
    const b = voiceNatives.create(ChannelMode.NonSpatial, 0);
    const ok =
      typeof a === "number" &&
      typeof b === "number" &&
      a !== b &&
      a < NO_CHANNEL &&
      b < NO_CHANNEL;
    if (ok) {
      voiceNatives.remove(a);
      voiceNatives.remove(b);
    }
    return ok;
  } catch {
    // Expected on Legacy: the native does not exist there.
    return false;
  }
}
