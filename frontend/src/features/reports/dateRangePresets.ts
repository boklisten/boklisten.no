import dayjs from "dayjs";

export const DATE_RANGE_PRESETS = ["dag", "uke", "semester", "ar", "all-time", "custom"] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  dag: "Dag",
  uke: "Uke",
  semester: "Semester",
  ar: "År",
  "all-time": "All-time",
  custom: "Custom",
};

export interface DateRangeValue {
  preset: DateRangePreset;
  customRange: [Date | null, Date | null];
}

export const DEFAULT_DATE_RANGE: DateRangeValue = {
  preset: "all-time",
  customRange: [null, null],
};

export interface ResolvedRange {
  from?: Date;
  to?: Date;
}

export function resolveDateRange({ preset, customRange }: DateRangeValue): ResolvedRange {
  switch (preset) {
    case "dag":
      return { from: dayjs().startOf("day").toDate(), to: dayjs().endOf("day").toDate() };
    case "uke":
      return { from: dayjs().startOf("week").toDate(), to: dayjs().endOf("week").toDate() };
    case "semester": {
      const isSpring = dayjs().month() < 7;
      const from = isSpring ? dayjs().month(0).date(1) : dayjs().month(7).date(1);
      const to = isSpring ? dayjs().month(6).date(31) : dayjs().month(11).date(31);
      return { from: from.startOf("day").toDate(), to: to.endOf("day").toDate() };
    }
    case "ar":
      return { from: dayjs().startOf("year").toDate(), to: dayjs().endOf("year").toDate() };
    case "all-time":
      return {};
    case "custom": {
      const [from, to] = customRange;
      return {
        ...(from && { from: dayjs(from).startOf("day").toDate() }),
        ...(to && { to: dayjs(to).endOf("day").toDate() }),
      };
    }
  }
}
