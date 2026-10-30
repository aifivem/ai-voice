import { waitFor } from "@aicore-fivem/lib/shared";
import { PMA } from "common";
import { effects } from "./effects";
import { registerClientExports } from "./exports";
import { mumble } from "./mumble";
import { phone } from "./phone";
import { proximity } from "./proximity";
import { radio } from "./radio";
import { backendKey, log, state } from "./state";

registerClientExports();
proximity.start();
radio.start();
phone.start();

// pma-voice hands its config to scripts that ask (`voiceModes` as { distance, label } pairs, like pma's Cfg).
on(PMA.settingsCallback, (cb: unknown) => {
  if (typeof cb === "function")
    cb({ voiceModes: state.settings.modes.map((m) => [m.distance, m.label]) });
});

/** Starts the half of the client that matches the server's backend (published once at the server's start). */
async function start(): Promise<void> {
  const backend = await waitFor(() => backendKey.get(), 30_000).catch(
    () => null,
  );
  if (!backend) return log.error("ai-voice server did not publish a backend");
  // On Enhanced the Mumble client natives (volume, submix) only work through `sv_mumble`.
  effects.setup(
    backend === "mumble" || GetConvar("sv_mumble", "false") === "true",
  );
  if (backend === "mumble") mumble.start();
}

void start();
