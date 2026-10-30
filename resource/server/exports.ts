import { provideExport, registerExport } from "@aicore-fivem/lib/server";
import { RANGE_MAX, RANGE_MIN, toChannel, type Proximity } from "common/voice";
import { checks } from "./checks";
import type { Groups } from "./groups";
import type { Mutes } from "./mute";
import type { Players } from "./players";
import type { Router } from "./router";

// oxlint-disable-next-line typescript/no-explicit-any -- export arguments come from any resource; each is parsed below
type Handler = (...args: any[]) => unknown;

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

/** The server exports: pma-voice's contract and ai-voice's own (range, mute, backend). */
export function registerServerExports(
  players: Players,
  groups: Groups,
  mutes: Mutes,
  router: Router,
): void {
  both("setPlayerRadio", (source: unknown, channel: unknown) => {
    const src = toSource(source);
    if (src) groups.setRadio(src, channelArg(channel, "radioChannel"), true);
  });
  both("setPlayerCall", (source: unknown, channel: unknown) => {
    const src = toSource(source);
    if (src) groups.setCall(src, channelArg(channel, "callChannel"), true);
  });
  const members = (channel: unknown) => {
    const id = toChannel(channel);
    return id === null ? {} : groups.radioMembers(id);
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
    return src !== null && players.get(src) !== undefined;
  });

  registerExport("getBackend", () => router.backend);
  registerExport(
    "setPlayerProximityMode",
    (source: unknown, index: unknown) => {
      const src = toSource(source);
      return src !== null && typeof index === "number"
        ? players.setMode(src, index)
        : false;
    },
  );
  registerExport("setPlayerRange", (source: unknown, range: unknown) => {
    const src = toSource(source);
    if (src === null) return false;
    if (range == null) return players.setRange(src, null);
    return typeof range === "number" && range >= RANGE_MIN && range <= RANGE_MAX
      ? players.setRange(src, range)
      : false;
  });
  registerExport("getPlayerProximity", (source: unknown): Proximity | null => {
    const src = toSource(source);
    return (src !== null && players.get(src)?.proximity()) || null;
  });
  registerExport("toggleMute", (source: unknown, seconds: unknown) => {
    const src = toSource(source);
    const time = typeof seconds === "number" && seconds > 0 ? seconds : 900;
    return src !== null && mutes.toggle(src, 0, time);
  });
  registerExport("addProximityCheck", (fn: unknown) => {
    if (!checks.addModeCheck(fn, invoker()))
      throw new Error("expected a function");
  });
}
