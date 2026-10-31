import {
  aiLogChannels,
  eventSource,
  GlobalKey,
  onCharacter,
  onClientEvent,
  onStop,
} from "@aicore-fivem/lib/server";
import { asArgs, createLogger } from "@aicore-fivem/lib/shared";
import { CORE } from "@aicore-fivem/shared";
import { ResourceName } from "common";
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
import { checks } from "./checks";
import { registerCommands } from "./commands";
import { content } from "./content";
import { EnhancedRouter } from "./enhanced";
import { registerServerExports } from "./exports";
import { Groups } from "./groups";
import { Mutes } from "./mute";
import { hasEnhancedVoice } from "./natives";
import { callBag, Players, proximityBag, radioBag } from "./players";
import { MumbleRouter, type Router } from "./router";
import { Speakers } from "./speaker";
import { watchTakeover } from "./takeover";

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
content.showStatus({ backendActive: backend });
log.info(`voice backend: ${backend}`);
watchTakeover();

const players = new Players(router);
const groups = new Groups(players, router);
const mutes = new Mutes(players);
const speakers = new Speakers(players, groups, router);
registerServerExports({ players, groups, mutes, router, speakers });
registerCommands(players, groups, mutes, router);

/** Places a player and puts back what they had (a restart of ai-voice keeps the bags). */
function join(source: number): void {
  const mode = proximityBag.get(source)?.index;
  const radio = radioBag.get(source) ?? 0;
  const call = callBag.get(source) ?? 0;
  players.join(source);
  mutes.join(source);
  if (mode !== undefined) players.setMode(source, mode);
  if (radio > 0) groups.setRadio(source, radio);
  if (call > 0) groups.setCall(source, call, true);
}

for (const id of getPlayers()) join(Number(id));

on("playerJoining", () => join(eventSource()));
// The voice stores are lib PlayerMaps; a drop turns the speaker off first, then leaves frequencies and the call.
players.onDrop((player) => {
  speakers.drop(player);
  groups.drop(player);
});

// Locked frequencies are checked again when jobs, duty, gangs or the character change (after lib `online` saw it).
const recheck = (source: unknown) => {
  if (typeof source === "number") setTimeout(() => groups.recheck(source), 0);
};
on(CORE.jobsChangedEvent, recheck);
on(CORE.dutyChangedEvent, recheck);
on(CORE.gangsChangedEvent, recheck);
onCharacter({ loaded: recheck, unloaded: recheck });
content.onFrequencies(() => {
  for (const player of players.all()) groups.recheck(player.source);
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
const toBool = ([v]: readonly unknown[]) =>
  asArgs(typeof v === "boolean" ? v : null);
const perSecond = (count: number) => ({ count, windowMs: 1000 });

onClientEvent(
  EVENTS.setMode,
  { args: toIndex, rate: perSecond(2) },
  (source, index) => players.setMode(source, index),
);
// Clients pick panel ranges only; a script range from a client is taken on Mumble (its audio is client-routed
// anyway), never on Enhanced, where the server would carry the voice that far.
onClientEvent(
  EVENTS.setRange,
  { args: toRange, rate: perSecond(1) },
  (source, range) =>
    router.backend === "mumble" || range === null
      ? players.setRange(source, range)
      : false,
);
onClientEvent(
  PMA.setPlayerRadio,
  { args: toChannelArg, rate: perSecond(2) },
  (source, channel) => groups.setRadio(source, channel),
);
onClientEvent(
  EVENTS.radioListen,
  {
    args: ([ch, on]) =>
      isChannel(ch) && typeof on === "boolean" ? [ch, on] : null,
    rate: perSecond(2),
  },
  (source, channel, on) => groups.listen(source, channel, on),
);
onClientEvent(
  EVENTS.radioActive,
  { args: toChannelArg, rate: perSecond(2) },
  (source, channel) => groups.setActive(source, channel),
);
onClientEvent(
  PMA.setTalkingOnRadio,
  { args: toBool, rate: perSecond(4) },
  (source, talking) => groups.setRadioTalking(source, talking),
);
// Joining a call from the client needs a phone script's check (or the panel's switch); hanging up is always allowed.
onClientEvent(
  PMA.setPlayerCall,
  { args: toChannelArg, rate: perSecond(2) },
  (source, channel) => {
    if (channel === 0 || checks.canClientJoinCall(source, channel))
      return groups.setCall(source, channel, false);
    log.warn(`player ${source} asked to join call ${channel}: refused`);
    groups.refuseCall(source);
  },
);
onClientEvent(
  EVENTS.setSpeaker,
  { args: toBool, rate: perSecond(2) },
  (source, on) => speakers.set(source, on),
);

onStop(() => router.stop());
