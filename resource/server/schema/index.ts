import type { PanelSchema } from "@aicore-fivem/shared";
import { channelsFile, channelsTab } from "./channels";
import { settingsFile, settingsTab } from "./settings";

/** ai-voice's panel: ranges, radio, phone and frequencies. */
export const schema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "microphone",
  files: {
    settings: settingsFile,
    channels: channelsFile,
  },
  tabs: [settingsTab, channelsTab],
};
