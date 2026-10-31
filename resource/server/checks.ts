import { ByResource, caller, online } from "@aicore-fivem/lib/server";
import { createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { content } from "./content";

const log = createLogger(ResourceName);

type Callback = (...args: unknown[]) => unknown;

/** Stores a callback another resource registered under the calling resource; false when it is not a function. */
function register<K>(
  map: ByResource<K, Callback>,
  key: K,
  fn: unknown,
): boolean {
  if (typeof fn !== "function") return false;
  map.set(key, fn as Callback);
  return true;
}

/** A callback from another resource: an error there (or its stop) counts as a refusal, never as a crash here. */
function ask(fn: Callback, ...args: unknown[]): unknown {
  try {
    return fn(...args);
  } catch (error) {
    log.error("a voice check from another resource failed", error);
    return false;
  }
}

/** pma-voice's `addChannelCheck` and `overrideRadioNameGetter`, ai-voice's range and call checks, the panel's job frequencies. */
class Checks {
  // Callbacks of other resources (the export's caller owns its entry), dropped when that resource stops.
  private readonly radio = new ByResource<number, Callback>();
  private readonly modes = new ByResource<string, Callback>();
  private readonly names = new ByResource<"name", Callback>();
  private readonly calls = new ByResource<string, Callback>();

  /** A phone script's answer to a call join a client asked for: `fn(source, callId) -> true` allows it. */
  addCallCheck(fn: unknown): boolean {
    return register(this.calls, caller(), fn);
  }

  /** A client asked to join a call: refused unless a phone script allows it (or the panel lets clients join). */
  canClientJoinCall(source: number, call: number): boolean {
    if (content.settings.clientCalls) return true;
    for (const fn of this.calls.values())
      if (ask(fn, source, call) === true) return true;
    return false;
  }

  addRadioCheck(channel: number, fn: unknown): boolean {
    return register(this.radio, channel, fn);
  }

  addModeCheck(fn: unknown): boolean {
    return register(this.modes, caller(), fn);
  }

  setNameGetter(fn: unknown): boolean {
    return register(this.names, "name", fn);
  }

  /** Whether a player may join a frequency: the panel's job ranges, then a script's check of that frequency. */
  canJoinRadio(source: number, channel: number): boolean {
    if (!this.jobAllows(source, channel)) return false;
    const fn = this.radio.get(channel);
    return !fn || Boolean(ask(fn, source));
  }

  /** The panel's access rule of a frequency (re-checked when jobs, duty or gangs change). */
  jobAllows(source: number, channel: number): boolean {
    const rule = content.frequencyOf(channel);
    return !rule || online.allows(source, rule.access);
  }

  /** Whether scripts allow a range change (each registered check must not answer false). */
  canSetRange(source: number, index: number, distance: number): boolean {
    for (const fn of this.modes.values())
      if (ask(fn, source, index, distance) === false) return false;
    return true;
  }

  /** The name radio members see (`syncNames`): a script's getter, else the character's name. */
  radioName(source: number): string {
    const fn = this.names.get("name");
    const custom = fn ? ask(fn, source) : null;
    if (typeof custom === "string") return custom;
    return online.name(source);
  }
}

export const checks = new Checks();
