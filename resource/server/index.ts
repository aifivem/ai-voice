import {
  addCommand,
  aiLogChannels,
  eventSource,
  GlobalKey,
  onClientEvent,
} from "@aicore-fivem/lib/server";
import { asArgs, createLogger } from "@aicore-fivem/lib/shared";
import { Locale, ResourceName } from "common";
import {
  EVENTS,
  isChannel,
  KEYS,
  parseBackend,
  PMA,
  RANGE_MAX,
  RANGE_MIN,
  type Backend,
} from "common/voice";
import { content } from "./content";
import { EnhancedRouter } from "./enhanced";
import { registerServerExports } from "./exports";
import { Groups } from "./groups";
import { Mutes } from "./mute";
import { hasEnhancedVoice } from "./natives";
import { callBag, Players, proximityBag, radioBag } from "./players";
import { MumbleRouter, type Router } from "./router";

const log = createLogger(ResourceName);
aiLogChannels({ mutes: {} });

/** The panel's choice; `auto` asks the server whether it has the Enhanced voice API. */
function chooseBackend(): Backend {
  const wanted = content.settings.backend;
  const enhanced = wanted !== "mumble" && hasEnhancedVoice();
  if (wanted === "enhanced" && !enhanced)
    log.error("Enhanced voice API missing on this server, using Mumble");
  return enhanced ? "enhanced" : "mumble";
}

const backend = chooseBackend();
const router: Router =
  backend === "enhanced"
    ? new EnhancedRouter(() => content.settings.modes.map((m) => m.distance))
    : new MumbleRouter();
new GlobalKey(KEYS.backend, parseBackend).set(backend);
log.info(`voice backend: ${backend}`);

const players = new Players(router);
const groups = new Groups(players, router);
const mutes = new Mutes(players);
registerServerExports(players, groups, mutes, router);

// A restart of ai-voice: the bags survive it, so players keep their range, radio and call.
for (const id of getPlayers()) {
  const source = Number(id);
  const mode = proximityBag.get(source)?.index;
  const radio = radioBag.get(source) ?? 0;
  const call = callBag.get(source) ?? 0;
  players.join(source);
  if (mode !== undefined) players.setMode(source, mode);
  if (radio > 0) groups.setRadio(source, radio, true);
  if (call > 0) groups.setCall(source, call, true);
}

on("playerJoining", () => players.join(eventSource()));
on("playerDropped", () => {
  const source = eventSource();
  groups.drop(source);
  mutes.clear(source);
  players.drop(source);
});

content.onSettings((next, old) => {
  if (JSON.stringify(next.modes) !== JSON.stringify(old.modes))
    players.reload();
  if (next.backend !== old.backend)
    log.warn("the voice backend changes on the next start of ai-voice");
});

const toIndex = ([v]: readonly unknown[]) =>
  asArgs(typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : null);
const toRange = ([v]: readonly unknown[]): [number | null] | null =>
  v == null
    ? [null]
    : typeof v === "number" && v >= RANGE_MIN && v <= RANGE_MAX
      ? [v]
      : null;
const toChannelArg = ([v]: readonly unknown[]) =>
  asArgs(isChannel(v) ? v : null);

onClientEvent(EVENTS.setMode, { args: toIndex }, (source, index) =>
  players.setMode(source, index),
);
onClientEvent(EVENTS.setRange, { args: toRange }, (source, range) =>
  players.setRange(source, range),
);
onClientEvent(PMA.setPlayerRadio, { args: toChannelArg }, (source, channel) =>
  groups.setRadio(source, channel, false),
);
onClientEvent(
  PMA.setTalkingOnRadio,
  { args: ([v]) => asArgs(typeof v === "boolean" ? v : null) },
  (source, talking) => groups.setRadioTalking(source, talking),
);
onClientEvent(PMA.setPlayerCall, { args: toChannelArg }, (source, channel) =>
  groups.setCall(source, channel, false),
);

addCommand(
  "muteply",
  {
    help: Locale("COMMAND_MUTE"),
    restricted: true,
    params: [
      { name: "id", type: "playerId", help: Locale("COMMAND_P_ID") },
      {
        name: "seconds",
        type: "number",
        help: Locale("COMMAND_P_SECONDS"),
        optional: true,
      },
    ] as const,
  },
  (source, args) => mutes.toggle(args.id, source, args.seconds ?? 900),
);

addCommand(
  "voicedebug",
  { help: Locale("COMMAND_DEBUG"), restricted: true },
  () => {
    log.info(`backend ${router.backend}`);
    for (const p of players.all())
      log.info(
        `${p.source}: range ${p.distance} m (mode ${p.mode}) radio ${p.radio} call ${p.call}${p.muted ? " muted" : ""}`,
      );
    for (const line of [...groups.describe(), ...router.describe()])
      log.info(line);
  },
);

on("onResourceStop", (resource: string) => {
  if (resource === ResourceName) router.stop();
});
