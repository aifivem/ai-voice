import { caller, registerExport } from "@aicore-fivem/lib/client";
import { PMA } from "common";
import { effects } from "./effects";
import { log } from "./state";
import { submixes, toSubmixSpec } from "./submixes";

// oxlint-disable-next-line typescript/no-explicit-any -- export arguments come from any resource; each is parsed below
type Handler = (...args: any[]) => unknown;

/**
 * Submixes through ai-voice (the game has 40 slots, shared with its own audio, and none can be deleted): create
 * reuses a name that exists, edit changes it, and pma-voice's submix exports register into the same registry.
 */
export function registerSubmixExports(
  both: (name: string, fn: Handler) => void,
): void {
  registerExport("createSubmix", (name: unknown, spec: unknown) => {
    if (typeof name !== "string" || !name) throw new Error("'name' expected");
    return submixes.create(name, toSubmixSpec(spec), caller());
  });
  registerExport("getSubmix", (name: unknown) =>
    typeof name === "string" ? submixes.get(name) : -1,
  );
  registerExport("editSubmix", (name: unknown, spec: unknown) =>
    typeof name === "string" ? submixes.edit(name, toSubmixSpec(spec)) : false,
  );
  registerExport("listSubmixes", () => submixes.list());

  // pma-voice: `registerCustomSubmix(cb)` where cb returns { name, id }; `setEffectSubmix("radio" | "call", id)`.
  both("registerCustomSubmix", (cb: unknown) => {
    if (typeof cb !== "function") throw new Error("'cb' expected a function");
    const result: unknown = cb();
    if (!Array.isArray(result)) return;
    const [name, id] = result as unknown[];
    if (typeof name === "string" && typeof id === "number")
      submixes.register(name, id, caller());
    else
      log.warn("registerCustomSubmix: the callback must return { name, id }");
  });
  both("setEffectSubmix", (kind: unknown, id: unknown) => {
    if (typeof id !== "number") throw new Error("'effectId' expected a number");
    if (kind === "radio") effects.setOverride("radio", id);
    else if (kind === "call" || kind === "phone")
      effects.setOverride("phone", id);
  });
  // Scripts that register their submixes when pma-voice asks.
  setTimeout(() => emit(PMA.registerCustomSubmixes), 0);
}
