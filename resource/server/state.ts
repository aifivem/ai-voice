import { Groups } from "./groups/groups";
import { Mutes } from "./mute";
import { Players } from "./players";
import { router } from "./routing/backend";
import { Speakers } from "./speaker";

/** The server's voice state on the chosen backend's router. */
export const players = new Players(router);
export const groups = new Groups(players, router);
export const mutes = new Mutes(players);
export const speakers = new Speakers(players, groups, router);
