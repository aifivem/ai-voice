import { onCharacter } from "@aicore-fivem/lib/server";
import { CORE } from "@aicore-fivem/shared";
import { content } from "../content";
import { groups, players } from "../state";

// Locked frequencies are checked again when jobs, duty, gangs or the character change (after lib `online` saw it).
const recheck = (source: unknown) => {
  if (typeof source === "number") setTimeout(() => groups.recheck(source), 0);
};
on(CORE.jobsChangedEvent, recheck);
on(CORE.dutyChangedEvent, recheck);
on(CORE.gangsChangedEvent, recheck);
onCharacter({ loaded: recheck, unloaded: recheck });
content.onFrequencies(() => {
  for (const player of players.all()) groups.recheck(player.source);
});
