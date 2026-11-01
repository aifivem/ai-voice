import { ACCESS_FIELDS, accessFields } from "@aicore-fivem/lib/shared";
import type { FileSpec, TabSpec } from "@aicore-fivem/shared";
import { ANIM_SET_NAMES } from "common/anim";
import { CHANNEL_MAX } from "common/channel";
import { animOptions } from "./widgets";

export const channelsFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: { from: 1, to: 10, jobs: ["police"], onDuty: true, anim: "" },
  sections: {
    label: { type: "text", min: 1, max: 48 },
    from: { type: "number", min: 0.01, max: CHANNEL_MAX },
    to: { type: "number", min: 0.01, max: CHANNEL_MAX },
    ...ACCESS_FIELDS,
    anim: {
      type: "enum",
      values: ["", "none", ...ANIM_SET_NAMES],
      optional: true,
    },
  },
};

export const channelsTab: TabSpec = {
  id: "channels",
  file: "channels",
  icon: "lock",
  label: "ADMIN_TAB_CHANNELS",
  desc: "ADMIN_TAB_CHANNELS_DESC",
  listSub: "jobs",
  createLabel: "ADMIN_NEW_CHANNEL",
  deleteLabel: "ADMIN_DELETE_CHANNEL",
  cards: [
    {
      icon: "lock",
      title: "ADMIN_C_CHANNEL",
      desc: "ADMIN_C_CHANNEL_DESC",
      fields: [
        {
          widget: "text",
          path: "label",
          label: "ADMIN_F_CHANNEL_NAME",
          placeholder: "ADMIN_P_CHANNEL_NAME",
        },
        {
          widget: "number",
          path: "from",
          label: "ADMIN_F_CHANNEL_FROM",
          hint: "ADMIN_H_CHANNEL_RANGE",
          min: 0.01,
          max: CHANNEL_MAX,
          step: 0.01,
        },
        {
          widget: "number",
          path: "to",
          label: "ADMIN_F_CHANNEL_TO",
          hint: "ADMIN_H_CHANNEL_RANGE",
          min: 0.01,
          max: CHANNEL_MAX,
          step: 0.01,
        },
        ...accessFields(),
        {
          widget: "select",
          path: "anim",
          label: "ADMIN_F_CHANNEL_ANIM",
          hint: "ADMIN_H_CHANNEL_ANIM",
          options: [
            { value: "", label: "ADMIN_O_ANIM_DEFAULT" },
            { value: "none", label: "ADMIN_O_ANIM_NONE" },
            ...animOptions,
          ],
        },
      ],
    },
  ],
};
