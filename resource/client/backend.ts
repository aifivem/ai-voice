import { waitFor } from "@aicore-fivem/lib/shared";
import { effects } from "./effects";
import { mumble } from "./mumble";
import { backendKey, log } from "./state";

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
