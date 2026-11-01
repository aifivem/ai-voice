import type { FileSpec, TabSpec } from "@aicore-fivem/shared";
import { ANIM_SET_NAMES } from "common/anim";
import { RANGE_MAX, RANGE_MIN } from "common/proximity";
import { SETTINGS_DEFAULTS } from "./defaults";
import { phoneCard } from "./settingsPhone";
import { animCard, radioCard } from "./settingsRadio";
import { backendCard, rangesCard } from "./settingsRanges";

const volume = { type: "number", min: 0, max: 100, integer: true } as const;

export const settingsFile: FileSpec = {
  kind: "settings",
  sync: "all",
  sections: {
    backend: { type: "enum", values: ["auto", "enhanced", "mumble"] },
    modes: {
      type: "list",
      min: 1,
      max: 6,
      of: {
        type: "object",
        fields: {
          label: { type: "text", min: 1, max: 24 },
          distance: { type: "number", min: RANGE_MIN, max: RANGE_MAX },
        },
      },
    },
    defaultMode: { type: "number", min: 1, max: 6, integer: true },
    cycle: { type: "bool" },
    rangeFactor: { type: "number", min: 1, max: 5 },
    radio: { type: "bool" },
    radioVolume: volume,
    maxRadioChannels: { type: "number", min: 1, max: 10, integer: true },
    radioAnim: { type: "bool" },
    radioAnimSet: { type: "enum", values: ANIM_SET_NAMES },
    radioAnimDict: { type: "text", min: 1, max: 64 },
    radioAnimClip: { type: "text", min: 1, max: 64 },
    radioAnimFlag: { type: "number", min: 0, max: 1023, integer: true },
    radioAnimInVehicle: { type: "bool" },
    radioSubmix: { type: "bool" },
    micClicks: { type: "bool" },
    syncNames: { type: "bool" },
    phone: { type: "bool" },
    phoneVolume: volume,
    phoneSubmix: { type: "bool" },
    clientCalls: { type: "bool" },
    speaker: { type: "bool" },
    speakerRadius: { type: "number", min: 0.5, max: 15 },
    speakerVolume: volume,
    speakerBidirectional: { type: "bool" },
    // Written by ai-voice (backend in use, scripts with their own effect), shown read only.
    backendActive: {
      type: "enum",
      values: ["mumble", "enhanced"],
      optional: true,
    },
    radioEffectBy: { type: "text", max: 64, optional: true },
    phoneEffectBy: { type: "text", max: 64, optional: true },
  },
  defaults: SETTINGS_DEFAULTS,
};

export const settingsTab: TabSpec = {
  id: "settings",
  file: "settings",
  icon: "sliders",
  label: "ADMIN_TAB_SETTINGS",
  desc: "ADMIN_TAB_SETTINGS_DESC",
  cards: [backendCard, rangesCard, radioCard, animCard, phoneCard],
};
