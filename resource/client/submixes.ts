import { isRecord } from "@aicore-fivem/lib/shared";
import { log } from "./state";

/** What a submix does: the radio filter, its parameters, the speaker volumes. Every field optional. */
export interface SubmixSpec {
  /** Put GTA's radio filter into this effect slot (the only effect FiveM offers). */
  radioFx?: boolean;
  /** Effect slot of `radioFx` and the parameters (default 0). */
  slot?: number;
  /** Float parameters by name (`freq_low`, `freq_hi`, `rm_mod_freq`, `rm_mix`, `fudge`, `o_freq_lo`, `o_freq_hi`). */
  params?: Record<string, number>;
  /** Integer parameters by name (`default`). */
  intParams?: Record<string, number>;
  /** Output volumes: front left, front right, rear left, rear right, channel 5, channel 6 (0-1). */
  volumes?: number[];
  /** Output submix id (default 0); set once, at creation. */
  output?: number;
}

/** Parses a spec from another resource (unknown fields drop). */
export function toSubmixSpec(value: unknown): SubmixSpec {
  if (!isRecord(value)) return {};
  const numbers = (v: unknown): Record<string, number> | undefined => {
    if (!isRecord(v)) return undefined;
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(v))
      if (typeof n === "number" && Number.isFinite(n)) out[k] = n;
    return out;
  };
  return {
    radioFx: value.radioFx === true,
    slot: typeof value.slot === "number" ? value.slot : undefined,
    params: numbers(value.params),
    intParams: numbers(value.intParams),
    volumes: Array.isArray(value.volumes)
      ? value.volumes.filter((v): v is number => typeof v === "number")
      : undefined,
    output: typeof value.output === "number" ? value.output : undefined,
  };
}

interface Entry {
  id: number;
  owner: string;
}

/**
 * Every audio submix of this client, by name. The game has 40 submix slots shared with its own audio (FiveM refuses
 * more with "Exceeded maximum number of audio submixes"; older builds corrupted memory), a submix can never be
 * deleted and a name is created once per game session. So scripts create through here: a name that exists is reused
 * and edited instead of taking another slot.
 */
class Submixes {
  private readonly entries = new Map<string, Entry>();

  /** The id of a name, creating it with `spec` when new; -1 when the game has no slot left. */
  create(name: string, spec: SubmixSpec, owner: string): number {
    const known = this.entries.get(name);
    if (known) return known.id;
    const id = CreateAudioSubmix(name);
    if (id === -1) {
      log.warn(
        `no audio submix slot left for "${name}" (the game has 40, shared with its own sounds)`,
      );
      return -1;
    }
    this.entries.set(name, { id, owner });
    this.apply(id, spec);
    AddAudioSubmixOutput(id, spec.output ?? 0);
    return id;
  }

  /** A submix another script made with CreateAudioSubmix itself (pma-voice `registerCustomSubmix`). */
  register(name: string, id: number, owner: string): void {
    if (id >= 0) this.entries.set(name, { id, owner });
  }

  get(name: string): number {
    return this.entries.get(name)?.id ?? -1;
  }

  /** Changes the filter, parameters or volumes of an existing submix. */
  edit(name: string, spec: SubmixSpec): boolean {
    const entry = this.entries.get(name);
    if (!entry) return false;
    this.apply(entry.id, spec);
    return true;
  }

  list(): Array<{ name: string; id: number; owner: string }> {
    return [...this.entries].map(([name, e]) => ({ name, ...e }));
  }

  private apply(id: number, spec: SubmixSpec): void {
    const slot = spec.slot ?? 0;
    if (spec.radioFx) SetAudioSubmixEffectRadioFx(id, slot);
    for (const [param, value] of Object.entries(spec.intParams ?? {}))
      SetAudioSubmixEffectParamInt(id, slot, GetHashKey(param), value);
    for (const [param, value] of Object.entries(spec.params ?? {}))
      SetAudioSubmixEffectParamFloat(id, slot, GetHashKey(param), value);
    const v = spec.volumes;
    if (v && v.length === 6)
      SetAudioSubmixOutputVolumes(
        id,
        0,
        v[0] ?? 1,
        v[1] ?? 1,
        v[2] ?? 0,
        v[3] ?? 0,
        v[4] ?? 1,
        v[5] ?? 1,
      );
  }
}

export const submixes = new Submixes();
