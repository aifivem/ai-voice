# ai-voice

Proximity voice with ranges, radio with push-to-talk and phone calls, on FiveM Legacy (Mumble) and FiveM for GTAV Enhanced (server voice channels) from one resource. Stands in for pma-voice (`provide 'pma-voice'` and its aliases, every export, state bag and event). Depends on ai-core (panel, keybinds, lib `online` for job frequencies). Design and research: `docs/voice-design.md`; compatibility list: `docs/compat/voice.md`.

## Decisions

- One backend per server start, chosen on the server (panel `backend`, `auto` probes the Enhanced API by creating two channels) and published in GlobalState `ai-voice:backend`; clients start the matching half. A panel change of the backend applies at the next start.
- The server owns all voice state on both backends: range, radio and call membership, admin mute. Clients ask through the lib gate; the server writes the bags. pma-voice wrote `proximity` from the client, which `sv_stateBagStrictMode` blocks, so on this server only ai-voice makes that bag real.
- Enhanced: per routing bucket one spatial channel per range in use; every player is in all of their bucket's channels and unmuted only in their range's. Radio is a 2D channel per frequency (muted until push-to-talk), a call a 2D channel per call. A 1 s server timer moves players whose routing bucket changed (no engine event exists).
- Mumble: pma-voice's model (own channel = server id, voice target 1, re-targeted every 200 ms within 3x the range because native audio carries further; call members always targeted, radio members while the radio key is held). ai-voice sets `voice_useNativeAudio` and `voice_useSendingRangeOnly` itself.
- Call members are voice targets for the whole call (pma added them per frame only while talking): Mumble sends nothing while silent, so no tick is needed.
- Radio / phone filters and volume overrides are Mumble client natives: on Enhanced they run only with `setr sv_mumble true`. Radio clicks are GTA sounds (`CB_RADIO_SFX`), so the script has no NUI; ai-hud draws range, talking and radio.
- Net events keep pma-voice's names and payloads (`resource/common/voice.ts` `PMA`): third-party radio UIs listen to them. That is the one exception to `<resource>:<camelCase>` event names.
- Player volumes and mic clicks are the player's own (client KVP `ai-voice:prefs`), defaulting to the panel's values.

## Contracts

- Server exports (also under `pma-voice`): `setPlayerRadio`, `setPlayerCall`, `getPlayersInRadioChannel` / `GetPlayersInRadioChannel`, `addChannelCheck`, `overrideRadioNameGetter`, `isValidPlayer`. Own: `getBackend`, `setPlayerProximityMode(source, index)`, `setPlayerRange(source, metres | null)`, `getPlayerProximity`, `toggleMute(source, seconds?)`, `addProximityCheck(fn(source, index, distance) -> false to refuse)`.
- Client exports: pma-voice's whole client list (`docs/compat/voice.md`) plus `addRadioDisableBit` / `removeRadioDisableBit`; own `cycleProximity`, `getBackend`, `isRadioTalking`.
- Player bags (server-written): `proximity` `{ index, distance, mode }`, `radioChannel`, `callChannel`, `muted`. Read: ai-core's `dead` and pma's `isDead`.
- Local events: client `pma-voice:setTalkingMode`, `pma-voice:radioActive`, `pma-voice:toggleRadioAnim`, answers `pma-voice:settingsCallback`; server `pma-voice:playerMuted`.
- Keybinds `voice_cycle` (F11) and `voice_radio` (left Alt). Commands `muteply`, `voicedebug` (admins).

## Pitfalls

- The Enhanced natives are in neither the typings nor `native.py`; they are called by hash in `server/natives.ts` (joaat of the upper-case name). Float arguments get FiveM's `+ 0.0000001`, or an integral distance arrives as an int.
- `AddPlayerToVoiceChannel` on a member resets its muted and deaf state: `VoiceChannel` never re-adds.
- A restart of ai-voice keeps the player bags: the server reads range, radio and call back from them at start.
- `provide` lines need a full server start before `GetResourceState("pma-voice")` reports started.

## Entry points

- Server: wiring `resource/server/index.ts`, backends `server/router.ts` (Mumble) and `server/enhanced.ts`, radio and calls `server/groups.ts`, panel `server/schema.ts`.
- Client: `resource/client/index.ts`, Legacy routing `client/mumble.ts`, radio `client/radio.ts`.
