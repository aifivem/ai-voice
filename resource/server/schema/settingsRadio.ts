import type { CardSpec } from "@aicore-fivem/shared";
import { animOptions, pct } from "./widgets";

export const radioCard: CardSpec = {
  icon: "comments",
  title: "ADMIN_C_RADIO",
  desc: "ADMIN_C_RADIO_DESC",
  fields: [
    { widget: "switch", path: "radio", label: "ADMIN_F_RADIO" },
    pct("radioVolume", "ADMIN_F_RADIO_VOLUME", "ADMIN_H_VOLUME"),
    {
      widget: "number",
      path: "maxRadioChannels",
      label: "ADMIN_F_MAX_CHANNELS",
      hint: "ADMIN_H_MAX_CHANNELS",
      min: 1,
      max: 10,
    },
    {
      widget: "switch",
      path: "radioSubmix",
      label: "ADMIN_F_RADIO_SUBMIX",
      hint: "ADMIN_H_SUBMIX",
    },
    {
      widget: "info",
      path: "radioEffectBy",
      label: "ADMIN_F_EFFECT_BY",
      hint: "ADMIN_H_EFFECT_BY",
      empty: "ADMIN_V_AI_VOICE",
      mono: true,
    },
    {
      widget: "switch",
      path: "micClicks",
      label: "ADMIN_F_MIC_CLICKS",
      hint: "ADMIN_H_MIC_CLICKS",
    },
    {
      widget: "switch",
      path: "syncNames",
      label: "ADMIN_F_SYNC_NAMES",
      hint: "ADMIN_H_SYNC_NAMES",
    },
  ],
};

export const animCard: CardSpec = {
  icon: "comments",
  title: "ADMIN_C_ANIM",
  desc: "ADMIN_C_ANIM_DESC",
  fields: [
    {
      widget: "switch",
      path: "radioAnim",
      label: "ADMIN_F_RADIO_ANIM",
      hint: "ADMIN_H_RADIO_ANIM",
    },
    {
      widget: "select",
      path: "radioAnimSet",
      label: "ADMIN_F_ANIM_SET",
      hint: "ADMIN_H_ANIM_SET",
      options: animOptions,
    },
    {
      widget: "text",
      path: "radioAnimDict",
      label: "ADMIN_F_ANIM_DICT",
      placeholder: "ADMIN_P_ANIM_DICT",
      showIf: { path: "radioAnimSet", values: ["custom"] },
    },
    {
      widget: "text",
      path: "radioAnimClip",
      label: "ADMIN_F_ANIM_CLIP",
      placeholder: "ADMIN_P_ANIM_CLIP",
      showIf: { path: "radioAnimSet", values: ["custom"] },
    },
    {
      widget: "number",
      path: "radioAnimFlag",
      label: "ADMIN_F_ANIM_FLAG",
      hint: "ADMIN_H_ANIM_FLAG",
      min: 0,
      max: 1023,
      showIf: { path: "radioAnimSet", values: ["custom"] },
    },
    {
      widget: "switch",
      path: "radioAnimInVehicle",
      label: "ADMIN_F_RADIO_ANIM_VEHICLE",
    },
  ],
};
