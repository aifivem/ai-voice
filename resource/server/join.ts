import { eventSource } from "@aicore-fivem/lib/server";
import { callBag, proximityBag, radioBag } from "./players";
import { groups, mutes, players, speakers } from "./state";

/** Places a player and puts back what they had (a restart of ai-voice keeps the bags). */
function join(source: number): void {
  const mode = proximityBag.get(source)?.index;
  const radio = radioBag.get(source) ?? 0;
  const call = callBag.get(source) ?? 0;
  players.join(source);
  mutes.join(source);
  if (mode !== undefined) players.setMode(source, mode);
  if (radio > 0) groups.setRadio(source, radio);
  if (call > 0) groups.setCall(source, call, true);
}

for (const id of getPlayers()) join(Number(id));

on("playerJoining", () => join(eventSource()));
// The voice stores are lib PlayerMaps; a drop turns the speaker off first, then leaves frequencies and the call.
players.onDrop((player) => {
  speakers.drop(player);
  groups.drop(player);
});
