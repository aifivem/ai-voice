/** Members of one channel: server id -> talking on it (calls keep false). */
export type Members = Map<number, boolean>;

/** pma-voice's member table as an object (msgpack keys arrive as strings; clients read them with Number()). */
export const table = (members: Members): Record<string, boolean> =>
  Object.fromEntries(members);

/** `voicedebug` lines of one kind of channel: id and member server ids. */
export const describeMembers = (kind: string, map: Map<number, Members>) =>
  [...map].map(([id, m]) => `${kind} ${id}: ${[...m.keys()].join(",")}`);
