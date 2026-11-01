import type { CardSpec } from "@aicore-fivem/shared";
import { RANGE_MAX, RANGE_MIN } from "common/proximity";

export const backendCard: CardSpec = {
  icon: "server",
  title: "ADMIN_C_BACKEND",
  desc: "ADMIN_C_BACKEND_DESC",
  fields: [
    {
      widget: "select",
      path: "backend",
      label: "ADMIN_F_BACKEND",
      hint: "ADMIN_H_BACKEND",
      options: [
        { value: "auto", label: "ADMIN_O_AUTO" },
        { value: "enhanced", label: "ADMIN_O_ENHANCED" },
        { value: "mumble", label: "ADMIN_O_MUMBLE" },
      ],
    },
    {
      widget: "info",
      path: "backendActive",
      label: "ADMIN_F_BACKEND_ACTIVE",
      values: {
        enhanced: "ADMIN_O_ENHANCED",
        mumble: "ADMIN_O_MUMBLE",
      },
    },
  ],
};

export const rangesCard: CardSpec = {
  icon: "microphone",
  title: "ADMIN_C_RANGES",
  desc: "ADMIN_C_RANGES_DESC",
  fields: [
    {
      widget: "list",
      path: "modes",
      label: "ADMIN_F_MODES",
      addLabel: "ADMIN_ADD_MODE",
      rowLabel: "ADMIN_ROW_MODE",
      max: 6,
      newRow: { label: "Far", distance: 10 },
      rows: [
        {
          widget: "text",
          path: "label",
          label: "ADMIN_F_MODE_LABEL",
          placeholder: "ADMIN_P_MODE_LABEL",
        },
        {
          widget: "number",
          path: "distance",
          label: "ADMIN_F_MODE_DISTANCE",
          hint: "ADMIN_H_MODE_DISTANCE",
          min: RANGE_MIN,
          max: RANGE_MAX,
          step: 0.5,
          unit: "m",
        },
      ],
    },
    {
      widget: "number",
      path: "defaultMode",
      label: "ADMIN_F_DEFAULT_MODE",
      hint: "ADMIN_H_DEFAULT_MODE",
      min: 1,
      max: 6,
    },
    {
      widget: "switch",
      path: "cycle",
      label: "ADMIN_F_CYCLE",
      hint: "ADMIN_H_CYCLE",
    },
    {
      widget: "number",
      path: "rangeFactor",
      label: "ADMIN_F_RANGE_FACTOR",
      hint: "ADMIN_H_RANGE_FACTOR",
      min: 1,
      max: 5,
      step: 0.5,
      unit: "x",
    },
  ],
};
