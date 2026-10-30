import { state } from "./state";

/**
 * What the receiving client does to a talker on radio or phone: a volume override and a submix (radio / phone filter).
 * These are Mumble natives; on Enhanced they work only with `sv_mumble` (FiveM has no other client voice API there).
 */
class Effects {
  enabled = false;
  private readonly submixes = { radio: -1, phone: -1 };
  /** Talkers whose submix reset is still pending: talking again within 250 ms keeps the filter. */
  private readonly keepSubmix = new Set<number>();

  /** Creates the submixes once (they live as long as the game). */
  setup(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled || this.submixes.radio !== -1) return;
    const radio = CreateAudioSubmix("Radio");
    SetAudioSubmixEffectRadioFx(radio, 0);
    SetAudioSubmixEffectParamInt(radio, 0, GetHashKey("default"), 1);
    AddAudioSubmixOutput(radio, 0);
    const phone = CreateAudioSubmix("Phone");
    SetAudioSubmixEffectRadioFx(phone, 1);
    SetAudioSubmixEffectParamInt(phone, 1, GetHashKey("default"), 1);
    SetAudioSubmixEffectParamFloat(phone, 1, GetHashKey("freq_low"), 300);
    SetAudioSubmixEffectParamFloat(phone, 1, GetHashKey("freq_hi"), 6000);
    AddAudioSubmixOutput(phone, 1);
    this.submixes.radio = radio;
    this.submixes.phone = phone;
  }

  /** pma-voice `toggleVoice`: a talker's radio / phone voice on or off. */
  toggle(serverId: number, on: boolean, kind: "radio" | "phone"): void {
    if (!this.enabled || state.mutedLocally.has(serverId)) return;
    const filter =
      kind === "radio"
        ? state.settings.radioSubmix
        : state.settings.phoneSubmix;
    if (on) {
      MumbleSetVolumeOverrideByServerId(serverId, state.volume(kind));
      if (filter) {
        this.keepSubmix.add(serverId);
        MumbleSetSubmixForServerId(serverId, this.submixes[kind]);
      }
      return;
    }
    // Someone still in our call keeps the phone voice when they stop talking on radio.
    if (kind === "radio" && state.call.has(serverId))
      return this.toggle(serverId, true, "phone");
    this.keepSubmix.delete(serverId);
    setTimeout(() => {
      if (!this.keepSubmix.has(serverId))
        MumbleSetSubmixForServerId(serverId, -1);
    }, 250);
    MumbleSetVolumeOverrideByServerId(serverId, -1);
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
