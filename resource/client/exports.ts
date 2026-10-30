import { provideExport, registerExport } from "@aicore-fivem/lib/client";
import { PMA, toChannel } from "common";
import { effects } from "./effects";
import { mumble } from "./mumble";
import { phone } from "./phone";
import { proximity } from "./proximity";
import { radio } from "./radio";
import { backendKey, log, state } from "./state";

// oxlint-disable-next-line typescript/no-explicit-any -- export arguments come from any resource; each is parsed below
type Handler = (...args: any[]) => unknown;

/** An export under ai-voice's name and pma-voice's (provide does not alias exports). */
function both(name: string, fn: Handler): void {
  registerExport(name, fn);
  provideExport("pma-voice", name, fn);
}

const channelArg = (value: unknown): number => {
  const channel = toChannel(value);
  if (channel === null) throw new Error("'channel' expected a number");
  return channel;
};

/** pma-voice `setVolume`: 0-100, one kind or both. */
function setVolume(volume: unknown, kind?: "radio" | "phone"): void {
  if (typeof volume !== "number" || volume < 0 || volume > 100)
    throw new Error("'volume' expected a number from 0 to 100");
  if (kind) state.prefs[kind] = volume;
  else state.prefs.radio = state.prefs.phone = volume;
  state.savePrefs();
}

/** The client exports: pma-voice's contract (and its mumble-voip / tokovoip aliases). */
export function registerClientExports(): void {
  const setRadio = (channel: unknown) => radio.setChannel(channelArg(channel));
  both("setRadioChannel", setRadio);
  both("SetRadioChannel", setRadio);
  both("addPlayerToRadio", setRadio);
  both("removePlayerFromRadio", () => radio.setChannel(0));

  const setCall = (channel: unknown) => phone.setChannel(channelArg(channel));
  both("setCallChannel", setCall);
  both("SetCallChannel", setCall);
  both("addPlayerToCall", setCall);
  both("removePlayerFromCall", () => phone.setChannel(0));

  both("setRadioVolume", (v: unknown) => setVolume(v, "radio"));
  both("getRadioVolume", () => state.volume("radio"));
  both("setCallVolume", (v: unknown) => setVolume(v, "phone"));
  both("getCallVolume", () => state.volume("phone"));

  const setProperty = (kind: unknown, value: unknown) => {
    if (kind === "radioEnabled") state.radioEnabled = value === true;
    else if (kind === "micClicks") {
      state.prefs.micClicks = value === true || value === "true";
      state.savePrefs();
    }
  };
  both("setVoiceProperty", setProperty);
  both("SetMumbleProperty", setProperty);
  both("SetTokoProperty", setProperty);

  both("overrideProximityRange", (range: unknown, disableCycle: unknown) =>
    proximity.override(range, disableCycle),
  );
  both("clearProximityOverride", () => proximity.clear());
  both("setAllowProximityCycleState", (blocked: unknown) => {
    if (typeof blocked !== "boolean")
      throw new Error("'state' expected a boolean");
    state.cycleBlocked = blocked;
  });
  both("overrideProximityCheck", (fn: unknown) =>
    mumble.setCheck(fn, GetInvokingResource() ?? ""),
  );
  both("resetProximityCheck", () => mumble.resetCheck());
  both("setVoiceState", (mode: unknown, channel: unknown) => {
    if (backendKey.get() !== "mumble")
      return log.warn("setVoiceState works only on the Mumble backend");
    void mumble.setVoiceState(mode, channel);
  });
  both("toggleMutePlayer", (serverId: unknown) => {
    if (typeof serverId === "number") effects.toggleMute(serverId);
  });
  both("toggleRadioAnim", () => {
    radio.animDisabled = !radio.animDisabled;
    emit(PMA.toggleRadioAnim, radio.animDisabled);
  });
  both("getRadioAnimState", () => radio.animDisabled);

  // Newer pma-voice: several resources can turn the radio off without undoing each other.
  both("addRadioDisableBit", (bit: unknown) => {
    if (typeof bit === "number") state.radioDisableBits |= bit;
  });
  both("removeRadioDisableBit", (bit: unknown) => {
    if (typeof bit === "number") state.radioDisableBits &= ~bit;
  });

  registerExport("cycleProximity", () => proximity.cycle());
  registerExport("getBackend", () => backendKey.get() ?? null);
  registerExport("isRadioTalking", () => state.radioPressed);
}
