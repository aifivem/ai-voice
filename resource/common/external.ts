/**
 * Adapter: local events of scripts that route radio or call audio themselves on Mumble. Answering them is what their
 * custom pma-voice files did, so they run on ai-voice without those files (`docs/compat/voice.md`).
 */
export const EXTERNAL = {
  /** tgiann-radio-v2: its push-to-talk is held (true) or released. */
  radioPressed: "tgiann-radio-v2:setRadioPressed",
  /** tgiann-phone: `{ [serverId]: true }` the call audio must reach. */
  callTargets: "tgiann-phone:voiceTargets",
} as const;
