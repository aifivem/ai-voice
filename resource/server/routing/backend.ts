import { createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import type { Backend } from "common/backend";
import { content } from "../content";
import { EnhancedRouter } from "./enhanced";
import { MumbleRouter } from "./mumble";
import { hasEnhancedVoice } from "./natives";
import type { Router } from "./router";

const log = createLogger(ResourceName);

/** The panel's choice; `auto` asks the server whether it has the Enhanced voice API. */
function chooseBackend(): Backend {
  const wanted = content.settings.backend;
  const enhanced = wanted !== "mumble" && hasEnhancedVoice();
  if (wanted === "enhanced" && !enhanced)
    log.error("Enhanced voice API missing on this server, using Mumble");
  return enhanced ? "enhanced" : "mumble";
}

export const backend = chooseBackend();
export const router: Router =
  backend === "enhanced"
    ? new EnhancedRouter(() => content.settings.modes.map((m) => m.distance))
    : new MumbleRouter();
