/** Who routes the audio: the clients through Mumble (Legacy) or the server through voice channels (Enhanced). */
export type Backend = "mumble" | "enhanced";
export const parseBackend = (v: unknown): Backend | undefined =>
  v === "mumble" || v === "enhanced" ? v : undefined;

export type BackendSetting = "auto" | Backend;
