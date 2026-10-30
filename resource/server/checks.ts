import { online } from "@aicore-fivem/lib/server";
import { createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { content } from "./content";

const log = createLogger(ResourceName);

type Callback = (...args: unknown[]) => unknown;

/** Callbacks other resources registered, keyed by K; dropped when the registering resource stops. */
class Registered<K> {
  private readonly entries = new Map<K, { resource: string; fn: Callback }>();

  set(key: K, fn: unknown, resource: string): boolean {
    if (typeof fn !== "function") return false;
    this.entries.set(key, { resource, fn: fn as Callback });
    return true;
  }

  get(key: K): Callback | undefined {
    return this.entries.get(key)?.fn;
  }

  values(): Callback[] {
    return [...this.entries.values()].map((e) => e.fn);
  }

  dropResource(resource: string): void {
    for (const [key, entry] of this.entries)
      if (entry.resource === resource) this.entries.delete(key);
  }
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
  private readonly radio = new Registered<number>();
  private readonly modes = new Registered<string>();
  private readonly names = new Registered<"name">();
  private readonly calls = new Registered<string>();

  constructor() {
    on("onResourceStop", (resource: string) => {
      this.radio.dropResource(resource);
      this.modes.dropResource(resource);
      this.names.dropResource(resource);
      this.calls.dropResource(resource);
    });
  }

  /** A phone script's answer to a call join a client asked for: `fn(source, callId) -> true` allows it. */
  addCallCheck(fn: unknown, resource: string): boolean {
    return this.calls.set(resource, fn, resource);
  }

  /** A client asked to join a call: refused unless a phone script allows it (or the panel lets clients join). */
  canClientJoinCall(source: number, call: number): boolean {
    if (content.settings.clientCalls) return true;
    return this.calls.values().some((fn) => ask(fn, source, call) === true);
  }

  addRadioCheck(channel: number, fn: unknown, resource: string): boolean {
    return this.radio.set(channel, fn, resource);
  }

  addModeCheck(fn: unknown, resource: string): boolean {
    return this.modes.set(resource, fn, resource);
  }

  setNameGetter(fn: unknown, resource: string): boolean {
    return this.names.set("name", fn, resource);
  }

  /** Whether a player may join a frequency: the panel's job ranges, then a script's check of that frequency. */
  canJoinRadio(source: number, channel: number): boolean {
    if (!this.jobAllows(source, channel)) return false;
    const fn = this.radio.get(channel);
    return !fn || Boolean(ask(fn, source));
  }

  /** The panel's job rule of a frequency (re-checked when jobs or duty change). */
  jobAllows(source: number, channel: number): boolean {
    const rule = content.frequencyOf(channel);
    if (!rule || rule.jobs.length === 0) return true;
    return rule.onDuty
      ? online.onDutyIn(source, rule.jobs)
      : online.jobs(source).some((job) => rule.jobs.includes(job));
  }

  /** Whether scripts allow a range change (each registered check must not answer false). */
  canSetRange(source: number, index: number, distance: number): boolean {
    return this.modes
      .values()
      .every((fn) => ask(fn, source, index, distance) !== false);
  }

  /** The name radio members see (`syncNames`): a script's getter, else the character's name. */
  radioName(source: number): string {
    const fn = this.names.get("name");
    const custom = fn ? ask(fn, source) : null;
    if (typeof custom === "string") return custom;
    const character = online.character(source);
    return character
      ? `${character.firstname} ${character.lastname}`
      : GetPlayerName(String(source));
  }
}

export const checks = new Checks();
