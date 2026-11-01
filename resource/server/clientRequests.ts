import { onClientEvent } from "@aicore-fivem/lib/server";
import { asArgs, createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { isChannel } from "common/channel";
import { RANGE_MAX, RANGE_MIN } from "common/proximity";
import { EVENTS, PMA } from "common/voice";
import { checks } from "./checks";
import { router } from "./routing/backend";
import { groups, players, speakers } from "./state";

const log = createLogger(ResourceName);

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
