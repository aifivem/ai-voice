import { playersNear } from "@aicore-fivem/lib/server";
import { EVENTS } from "common";
import { content } from "./content";
import type { Groups } from "./groups";
import { speakerBag, type Players } from "./players";
import type { Router } from "./router";

/** What one client's loudspeaker audio is: whom to reach, whom to hear as a call or as a loudspeaker. */
interface Audio {
  send: number[];
  call: number[];
  speaker: number[];
}
const EMPTY_KEY = "||";
const key = (a: Audio): string =>
  `${a.send.join(",")}|${a.call.join(",")}|${a.speaker.join(",")}`;

/** A phone with the loudspeaker on: its call and the players standing around it. */
interface Holder {
  call: number;
  near: Set<number>;
}

/**
 * Phone loudspeakers: players near a phone with the speaker on hear the other side of the call (and, two-way, are
 * heard by it). A 1 s timer runs only while a speaker is on. Enhanced puts the bystanders into the call's channel;
 * Mumble clients get their extra send / hear sets (`EVENTS.callAudio`), only when a set changed.
 */
export class Speakers {
  private readonly holders = new Map<number, Holder>();
  /** Per client: the audio last sent (Mumble). */
  private readonly sent = new Map<number, string>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly players: Players,
    private readonly groups: Groups,
    private readonly router: Router,
  ) {
    // A new call or a hang-up turns the loudspeaker off.
    groups.onCallChange((source) => {
      if (this.holders.has(source)) this.set(source, false);
    });
  }

  isOn(source: number): boolean {
    return this.holders.has(source);
  }

  /** Loudspeaker on / off for a player in a call. */
  set(source: number, on: boolean): boolean {
    const player = this.players.get(source);
    if (!player) return false;
    if (on && (!content.settings.speaker || player.call === 0)) return false;
    if (on === this.holders.has(source)) return true;
    player.speaker = on;
    speakerBag.set(source, on);
    if (on) this.holders.set(source, { call: player.call, near: new Set() });
    else {
      this.place(source, new Set());
      this.holders.delete(source);
    }
    this.update();
    if (this.holders.size > 0)
      this.timer ??= setInterval(() => this.update(), 1000);
    else if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    return true;
  }

  /** The player left. */
  drop(source: number): void {
    if (this.holders.has(source)) this.set(source, false);
    for (const holder of this.holders.values()) holder.near.delete(source);
    this.sent.delete(source);
  }

  private update(): void {
    const radius = content.settings.speakerRadius;
    for (const [source, holder] of this.holders) {
      const members = this.groups.callMembers(holder.call);
      const near = new Set(
        playersNear(source, radius).filter(
          (id) => id !== source && !members.has(id),
        ),
      );
      this.place(source, near);
    }
    if (this.router.backend === "mumble") this.sendAudio();
  }

  /** Enhanced: bystanders join / leave the call's channel. */
  private place(source: number, next: Set<number>): void {
    const holder = this.holders.get(source);
    if (!holder) return;
    const talks = content.settings.speakerBidirectional;
    for (const id of holder.near)
      if (!next.has(id))
        this.router.callBystander(id, holder.call, false, talks);
    for (const id of next)
      if (!holder.near.has(id))
        this.router.callBystander(id, holder.call, true, talks);
    holder.near = next;
  }

  /** Mumble: every affected client's send / hear sets, sent when they changed. */
  private sendAudio(): void {
    const audio = new Map<number, Audio>();
    const of = (id: number): Audio => {
      let a = audio.get(id);
      if (!a) audio.set(id, (a = { send: [], call: [], speaker: [] }));
      return a;
    };
    const twoWay = content.settings.speakerBidirectional;
    for (const [source, holder] of this.holders) {
      const remote = [...this.groups.callMembers(holder.call).keys()].filter(
        (id) => id !== source,
      );
      for (const b of holder.near) {
        const mine = of(b);
        mine.speaker.push(...remote);
        if (twoWay) mine.send.push(...remote);
        for (const r of remote) {
          of(r).send.push(b);
          if (twoWay) of(r).call.push(b);
        }
      }
    }
    for (const [id, last] of this.sent)
      if (!audio.has(id) && last !== EMPTY_KEY) {
        emitNet(EVENTS.callAudio, id, { send: [], call: [], speaker: [] });
        this.sent.set(id, EMPTY_KEY);
      }
    for (const [id, a] of audio) {
      const k = key(a);
      if (this.sent.get(id) === k) continue;
      this.sent.set(id, k);
      emitNet(EVENTS.callAudio, id, a);
    }
  }
}
