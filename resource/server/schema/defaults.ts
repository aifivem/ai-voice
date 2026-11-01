import { ANIM_SETS } from "common/anim";
import { DEFAULT_MODES } from "common/settings";

/** The built-in settings; pma-voice's cfg convars replace a default the owner never changed (`convars.ts`). */
export const SETTINGS_DEFAULTS = {
  backend: "auto",
  modes: DEFAULT_MODES,
  defaultMode: 2,
  cycle: true,
  rangeFactor: 3,
  radio: true,
  radioVolume: 30,
  maxRadioChannels: 3,
  radioAnim: false,
  radioAnimSet: "shoulder",
  radioAnimDict: ANIM_SETS.shoulder.dict,
  radioAnimClip: ANIM_SETS.shoulder.clip,
  radioAnimFlag: 49,
  radioAnimInVehicle: true,
  radioSubmix: true,
  micClicks: true,
  syncNames: false,
  phone: true,
  phoneVolume: 60,
  phoneSubmix: true,
  clientCalls: false,
  speaker: true,
  speakerRadius: 3,
  speakerVolume: 60,
  speakerBidirectional: true,
} satisfies Record<string, unknown>;
