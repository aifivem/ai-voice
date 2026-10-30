import {
  PlayerState,
  provideExport,
  registerExport,
  stateString,
} from "@aicore-fivem/lib/server";
import {
  KEYS,
  RANGE_MAX,
  RANGE_MIN,
  toChannel,
  type Proximity,
} from "common/voice";
import { checks } from "./checks";
import type { Groups } from "./groups";
import type { Mutes } from "./mute";
import type { Players } from "./players";
import type { Router } from "./router";
import type { Speakers } from "./speaker";

// oxlint-disable-next-line typescript/no-explicit-any -- export arguments come from any resource; each is parsed below
type Handler = (...args: any[]) => unknown;

/** pma-voice's lasting voice effect of a player (a submix name the clients registered). */
const submixBag = new PlayerState(KEYS.submix, stateString);

/** An export under ai-voice's name and pma-voice's (provide does not alias exports). */
function both(name: string, fn: Handler): void {
  registerExport(name, fn);
  provideExport("pma-voice", name, fn);
}

const toSource = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
};

const invoker = (): string => GetInvokingResource() ?? "unknown";

function channelArg(value: unknown, what: string): number {
  const channel = toChannel(value);
  if (channel === null) throw new Error(`'${what}' expected a number`);
  return channel;
}

export interface Services {
  players: Players;
  groups: Groups;
  mutes: Mutes;
  router: Router;
  speakers: Speakers;
}

/** The server exports: pma-voice's contract and ai-voice's own (range, mute, frequencies, speaker, submix). */
export function registerServerExports(s: Services): void {
  both("setPlayerRadio", (source: unknown, channel: unknown) => {
    const src = toSource(source);
    if (src) s.groups.setRadio(src, channelArg(channel, "radioChannel"));
  });
  both("setPlayerCall", (source: unknown, channel: unknown) => {
    const src = toSource(source);
    if (src) s.groups.setCall(src, channelArg(channel, "callChannel"), true);
  });
  const members = (channel: unknown) => {
    const id = toChannel(channel);
    return id === null ? {} : s.groups.radioMembers(id);
  };
  both("getPlayersInRadioChannel", members);
  both("GetPlayersInRadioChannel", members);
  both("addChannelCheck", (channel: unknown, fn: unknown) => {
    if (!checks.addRadioCheck(channelArg(channel, "channel"), fn, invoker()))
      throw new Error("'cb' expected a function");
  });
  both("overrideRadioNameGetter", (_channel: unknown, fn: unknown) => {
    if (!checks.setNameGetter(fn, invoker()))
      throw new Error("'cb' expected a function");
  });
  both("isValidPlayer", (source: unknown) => {
    const src = toSource(source);
    return src !== null && s.players.get(src) !== undefined;
  });

  registerExport("getBackend", () => s.router.backend);
  registerExport(
    "setPlayerProximityMode",
    (source: unknown, index: unknown) => {
      const src = toSource(source);
      return src !== null && typeof index === "number"
        ? s.players.setMode(src, index)
        : false;
    },
  );
  registerExport("setPlayerRange", (source: unknown, range: unknown) => {
    const src = toSource(source);
    if (src === null) return false;
    if (range == null) return s.players.setRange(src, null);
    return typeof range === "number" && range >= RANGE_MIN && range <= RANGE_MAX
      ? s.players.setRange(src, range)
      : false;
  });
  registerExport("getPlayerProximity", (source: unknown): Proximity | null => {
    const src = toSource(source);
    return (src !== null && s.players.get(src)?.proximity()) || null;
  });
  registerExport("toggleMute", (source: unknown, seconds: unknown) => {
    const src = toSource(source);
    const time = typeof seconds === "number" && seconds > 0 ? seconds : 900;
    return src !== null && s.mutes.toggle(src, 0, time);
  });
  registerExport("addProximityCheck", (fn: unknown) => {
    if (!checks.addModeCheck(fn, invoker()))
      throw new Error("expected a function");
  });

  // Several frequencies at once: hear every joined one, talk on the active one.
  registerExport(
    "addPlayerRadioListen",
    (source: unknown, channel: unknown) => {
      const src = toSource(source);
      return (
        src !== null &&
        s.groups.listen(src, channelArg(channel, "channel"), true)
      );
    },
  );
  registerExport(
    "removePlayerRadioListen",
    (source: unknown, channel: unknown) => {
      const src = toSource(source);
      return (
        src !== null &&
        s.groups.listen(src, channelArg(channel, "channel"), false)
      );
    },
  );
  registerExport(
    "setPlayerRadioActive",
    (source: unknown, channel: unknown) => {
      const src = toSource(source);
      return (
        src !== null && s.groups.setActive(src, channelArg(channel, "channel"))
      );
    },
  );
  registerExport("getPlayerRadioChannels", (source: unknown) => {
    const src = toSource(source);
    const player = src === null ? undefined : s.players.get(src);
    return player
      ? { active: player.radio, channels: [...player.radios] }
      : null;
  });

  // Phone: client joins need a check; the loudspeaker lets players nearby hear the call.
  registerExport("addCallCheck", (fn: unknown) => {
    if (!checks.addCallCheck(fn, invoker()))
      throw new Error("expected a function");
  });
  registerExport("setPlayerCallSpeaker", (source: unknown, on: unknown) => {
    const src = toSource(source);
    return src !== null && s.speakers.set(src, on === true);
  });
  registerExport("getPlayerCallSpeaker", (source: unknown) => {
    const src = toSource(source);
    return src !== null && s.speakers.isOn(src);
  });

  // pma-voice's `submix` bag: a lasting effect on a player's voice (a submix name registered on the clients).
  registerExport("setPlayerSubmix", (source: unknown, name: unknown) => {
    const src = toSource(source);
    if (src === null) return;
    submixBag.set(src, typeof name === "string" && name ? name : undefined);
  });
}
