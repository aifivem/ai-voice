import { createLogger } from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { content } from "./content";
import { players } from "./state";

const log = createLogger(ResourceName);

content.onSettings((next, old) => {
  if (JSON.stringify(next.modes) !== JSON.stringify(old.modes))
    players.reload();
  if (next.backend !== old.backend)
    log.warn("the voice backend changes on the next start of ai-voice");
});
