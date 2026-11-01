import { PMA } from "common";
import { state } from "./state";

// pma-voice hands its config to scripts that ask (`voiceModes` as { distance, label } pairs, like pma's Cfg).
on(PMA.settingsCallback, (cb: unknown) => {
  if (typeof cb === "function")
    cb({ voiceModes: state.settings.modes.map((m) => [m.distance, m.label]) });
});
