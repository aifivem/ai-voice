import { GlobalKey, isResourceStarted } from "@aicore-fivem/lib/server";
import { createLogger } from "@aicore-fivem/lib/shared";
import { KEYS, ResourceName } from "common";
import { parseTakeover, type Takeover } from "common/takeover";
import { content } from "./content";

const log = createLogger(ResourceName);
const takeoverKey = new GlobalKey(KEYS.takeover, parseTakeover);

/**
 * Scripts known to bring their own effect (owner decision: only these, no config reading). lb-phone is not detected:
 * an owner whose lb-phone applies its own call effect turns the phone effect off in the panel.
 */
const RADIO = ["tgiann-radio-v2", "tgiann-radio"];
const PHONE = ["tgiann-phone"];
const WATCHED = new Set([...RADIO, ...PHONE]);

const detect = (): Takeover => ({
  radio: RADIO.find((name) => isResourceStarted(name)) ?? null,
  phone: PHONE.find((name) => isResourceStarted(name)) ?? null,
});

/**
 * Which running scripts bring their own radio / phone effect: clients then leave ai-voice's effect off (and never
 * create its submix). Published in GlobalState, shown next to the effect switches, checked again on start / stop.
 */
export function watchTakeover(): void {
  // GlobalState outlives a restart of ai-voice: compare it only after the first publish.
  let first = true;
  const apply = () => {
    const next = detect();
    const old = takeoverKey.get();
    if (!first && old?.radio === next.radio && old?.phone === next.phone)
      return;
    first = false;
    takeoverKey.set(next);
    content.showStatus({
      radioEffectBy: next.radio ?? "",
      phoneEffectBy: next.phone ?? "",
    });
    if (next.radio) log.info(`${next.radio} brings its own radio effect`);
    if (next.phone) log.info(`${next.phone} brings its own phone effect`);
  };
  apply();
  const changed = (resource: string) => {
    if (WATCHED.has(resource)) setTimeout(apply, 0);
  };
  on("onResourceStart", changed);
  on("onResourceStop", changed);
}

watchTakeover();
