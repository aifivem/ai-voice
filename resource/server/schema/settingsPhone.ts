import type { CardSpec } from "@aicore-fivem/shared";
import { pct } from "./widgets";

export const phoneCard: CardSpec = {
  icon: "comments",
  title: "ADMIN_C_PHONE",
  desc: "ADMIN_C_PHONE_DESC",
  fields: [
    { widget: "switch", path: "phone", label: "ADMIN_F_PHONE" },
    pct("phoneVolume", "ADMIN_F_PHONE_VOLUME", "ADMIN_H_VOLUME"),
    {
      widget: "switch",
      path: "phoneSubmix",
      label: "ADMIN_F_PHONE_SUBMIX",
      hint: "ADMIN_H_PHONE_SUBMIX",
    },
    {
      widget: "info",
      path: "phoneEffectBy",
      label: "ADMIN_F_EFFECT_BY",
      hint: "ADMIN_H_EFFECT_BY",
      empty: "ADMIN_V_AI_VOICE",
      mono: true,
    },
    {
      widget: "switch",
      path: "clientCalls",
      label: "ADMIN_F_CLIENT_CALLS",
      hint: "ADMIN_H_CLIENT_CALLS",
    },
    {
      widget: "switch",
      path: "speaker",
      label: "ADMIN_F_SPEAKER",
      hint: "ADMIN_H_SPEAKER",
    },
    {
      widget: "number",
      path: "speakerRadius",
      label: "ADMIN_F_SPEAKER_RADIUS",
      hint: "ADMIN_H_SPEAKER_RADIUS",
      min: 0.5,
      max: 15,
      step: 0.5,
      unit: "m",
    },
    pct("speakerVolume", "ADMIN_F_SPEAKER_VOLUME", "ADMIN_H_VOLUME"),
    {
      widget: "switch",
      path: "speakerBidirectional",
      label: "ADMIN_F_SPEAKER_TWO_WAY",
      hint: "ADMIN_H_SPEAKER_TWO_WAY",
    },
  ],
};
