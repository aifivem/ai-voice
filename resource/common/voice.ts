/** ai-voice's own events. */
export const EVENTS = {
  /** client -> server: a range of the panel (1-based). */
  setMode: "ai-voice:setMode",
  /** client -> server: a script range on the Mumble backend (metres or null). */
  setRange: "ai-voice:setRange",
  /** client -> server: listen to one more frequency (true) or leave it (false). */
  radioListen: "ai-voice:radioListen",
  /** client -> server: talk on this joined frequency. */
  radioActive: "ai-voice:radioActive",
  /** client -> server: phone loudspeaker on / off. */
  setSpeaker: "ai-voice:setSpeaker",
  /** server -> client: who a phone loudspeaker adds `{ send, hear }` (server ids). */
  callAudio: "ai-voice:callAudio",
} as const;

/**
 * pma-voice's net and local events, kept by name and payload: ai-hud and third-party radio / phone scripts listen to
 * them, and some send the client -> server ones themselves. Radio events carry the frequency as one extra last argument
 * (pma's listeners ignore it).
 */
export const PMA = {
  setPlayerRadio: "pma-voice:setPlayerRadio",
  setTalkingOnRadio: "pma-voice:setTalkingOnRadio",
  setPlayerCall: "pma-voice:setPlayerCall",
  syncRadioData: "pma-voice:syncRadioData",
  addPlayerToRadio: "pma-voice:addPlayerToRadio",
  removePlayerFromRadio: "pma-voice:removePlayerFromRadio",
  clSetPlayerRadio: "pma-voice:clSetPlayerRadio",
  syncCallData: "pma-voice:syncCallData",
  addPlayerToCall: "pma-voice:addPlayerToCall",
  removePlayerFromCall: "pma-voice:removePlayerFromCall",
  clSetPlayerCall: "pma-voice:clSetPlayerCall",
  setTalkingMode: "pma-voice:setTalkingMode",
  radioActive: "pma-voice:radioActive",
  toggleRadioAnim: "pma-voice:toggleRadioAnim",
  settingsCallback: "pma-voice:settingsCallback",
  playerMuted: "pma-voice:playerMuted",
  registerCustomSubmixes: "pma-voice:registerCustomSubmixes",
} as const;

/** State bag keys: pma-voice's player keys and ai-voice's own (`proximity` is `PLAYER_BAGS.proximity` in @aicore-fivem/shared). */
export const KEYS = {
  backend: "ai-voice:backend",
  /** Scripts that bring their own radio / phone effect (`Takeover`). */
  takeover: "ai-voice:takeover",
  radioChannel: "radioChannel",
  callChannel: "callChannel",
  muted: "muted",
  /** pma-voice's lasting voice effect of a player: the name of a registered submix. */
  submix: "submix",
  /** The player's phone loudspeaker is on. */
  callSpeaker: "callSpeaker",
  /** pma-voice's death flag (death scripts written for pma); ai-core's own is PLAYER_BAGS.dead. */
  isDead: "isDead",
} as const;
