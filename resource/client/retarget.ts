import { mumble } from "./mumble";
import { backendKey } from "./state";

const isMumble = (): boolean => backendKey.get() === "mumble";

/** Mumble: the voice target is built again (who is heard changed). */
export const retarget = (): void => {
  if (isMumble()) mumble.refreshPlayerTargets();
};
