import { addCommand } from "@aicore-fivem/lib/server";
import { createLogger } from "@aicore-fivem/lib/shared";
import { Locale, ResourceName } from "common";
import type { Groups } from "./groups";
import type { Mutes } from "./mute";
import type { Players } from "./players";
import type { Router } from "./router";

const log = createLogger(ResourceName);

/** Admin commands: pma-voice's `/muteply` and the voice state dump. */
export function registerCommands(
  players: Players,
  groups: Groups,
  mutes: Mutes,
  router: Router,
): void {
  addCommand(
    "muteply",
    {
      help: Locale("COMMAND_MUTE"),
      restricted: true,
      params: [
        { name: "id", type: "playerId", help: Locale("COMMAND_P_ID") },
        {
          name: "seconds",
          type: "number",
          help: Locale("COMMAND_P_SECONDS"),
          optional: true,
        },
      ] as const,
    },
    (source, args) => mutes.toggle(args.id, source, args.seconds ?? 900),
  );

  addCommand(
    "voicedebug",
    { help: Locale("COMMAND_DEBUG"), restricted: true },
    () => {
      log.info(`backend ${router.backend}`);
      for (const p of players.all())
        log.info(
          `${p.source}: range ${p.distance} m (mode ${p.mode}) radio ${p.radio} [${[...p.radios].join(",")}] call ${p.call}${p.speaker ? " speaker" : ""}${p.muted ? " muted" : ""}`,
        );
      for (const line of [...groups.describe(), ...router.describe()])
        log.info(line);
    },
  );
}
