import { submixes } from "./submixes";
import { state, submixBag, takeoverKey } from "./state";

export type EffectKind = "radio" | "phone" | "speaker";

/** ai-voice's own submixes (created only when used, never when switched off or a script brings its own). */
const DEFAULTS = {
  radio: {
    name: "Radio",
    spec: { radioFx: true, slot: 0, intParams: { default: 1 }, output: 0 },
  },
  phone: {
    name: "Phone",
    spec: {
      radioFx: true,
      slot: 1,
      intParams: { default: 1 },
      params: { freq_low: 300, freq_hi: 6000 },
      output: 1,
    },
  },
} as const;

/**
 * What the receiving client does to a talker on radio or phone: a volume override and a submix (radio / phone filter).
 * These are Mumble natives; on Enhanced they work only with `sv_mumble` (FiveM has no other client voice API there).
 */
class Effects {
  enabled = false;
  /** pma-voice `setEffectSubmix`: another script's submix id for the radio or the call. */
  private readonly overrides: { radio: number | null; phone: number | null } = {
    radio: null,
    phone: null,
  };
  /** Talkers whose effect is on now; talking again within 250 ms keeps the filter. */
  private readonly active = new Map<number, EffectKind>();

  setup(enabled: boolean): void {
    this.enabled = enabled;
    // A talker's lasting effect (pma-voice `submix` bag) applies while no radio / call effect is on them.
    submixBag.onChange((id) => {
      if (this.enabled && !this.active.has(id)) this.restore(id);
    });
  }

  setOverride(kind: "radio" | "phone", id: number): void {
    this.overrides[kind] = id >= 0 ? id : null;
  }

  /** The submix of a kind, -1 when it is off: switched off in the panel or a running script brings its own. */
  submixOf(kind: "radio" | "phone"): number {
    const override = this.overrides[kind];
    if (override !== null) return override;
    const on =
      kind === "radio"
        ? state.settings.radioSubmix
        : state.settings.phoneSubmix;
    const takenBy = takeoverKey.get()?.[kind] ?? null;
    if (!on || takenBy) return -1;
    const def = DEFAULTS[kind];
    return submixes.create(def.name, def.spec, GetCurrentResourceName());
  }

  /** pma-voice `toggleVoice`: a talker's radio / phone / loudspeaker voice on or off. */
  toggle(serverId: number, on: boolean, kind: EffectKind): void {
    if (!this.enabled || state.mutedLocally.has(serverId)) return;
    if (on) {
      this.active.set(serverId, kind);
      MumbleSetVolumeOverrideByServerId(serverId, this.volume(kind));
      const submix = this.submixOf(kind === "radio" ? "radio" : "phone");
      if (submix >= 0) MumbleSetSubmixForServerId(serverId, submix);
      return;
    }
    // Someone still in our call (or heard through a loudspeaker) keeps the phone voice.
    if (kind === "radio" && state.call.has(serverId))
      return this.toggle(serverId, true, "phone");
    this.active.delete(serverId);
    MumbleSetVolumeOverrideByServerId(serverId, -1);
    setTimeout(() => {
      if (!this.active.has(serverId)) this.restore(serverId);
    }, 250);
  }

  /** pma-voice `toggleMutePlayer`: silences one player for this client only. */
  toggleMute(serverId: number): void {
    if (state.mutedLocally.delete(serverId)) {
      if (this.enabled) MumbleSetVolumeOverrideByServerId(serverId, -1);
      return;
    }
    state.mutedLocally.add(serverId);
    if (this.enabled) MumbleSetVolumeOverrideByServerId(serverId, 0);
  }

  private volume(kind: EffectKind): number {
    return kind === "speaker"
      ? state.settings.speakerVolume / 100
      : state.volume(kind);
  }

  /** Back to the talker's lasting effect, or none. */
  private restore(serverId: number): void {
    const name = submixBag.get(serverId);
    MumbleSetSubmixForServerId(serverId, name ? submixes.get(name) : -1);
  }
}

export const effects = new Effects();

/** The radio click: GTA's own squelch sounds, so no NUI is needed. */
export function micClick(on: boolean): void {
  if (!state.micClicks()) return;
  PlaySoundFrontend(
    -1,
    on ? "Start_Squelch" : "End_Squelch",
    "CB_RADIO_SFX",
    true,
  );
}
