import { fromServer } from "@aicore-fivem/lib/client";
import { EXTERNAL, PMA } from "common";
import { parseMembers } from "./members";
import { retarget } from "./retarget";
import { state } from "./state";

/**
 * tgiann-radio-v2 runs its own radio on Mumble: while its key is held its members stay in the voice target. Its
 * local `pma-voice:syncRadioData` carries them (a server event to ai-voice always comes with a frequency).
 */
on(EXTERNAL.radioPressed, (pressed: unknown) => {
  state.externalRadioPressed = pressed === true;
  retarget();
});
on(PMA.syncRadioData, (members: unknown) => {
  if (fromServer()) return;
  state.externalRadio.clear();
  for (const id of parseMembers(members)?.keys() ?? [])
    state.externalRadio.add(id);
  if (state.externalRadioPressed) retarget();
});
