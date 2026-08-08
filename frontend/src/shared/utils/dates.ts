import dayjs from "dayjs";

import { norwegianTime } from "@/shared/utils/dayjs";

export function isUnder18(birthday: Date) {
  return dayjs(birthday).isAfter(dayjs().subtract(18, "year"));
}

export function formatOpeningHour(openingHour: { from: dayjs.ConfigType; to: dayjs.ConfigType }) {
  const from = norwegianTime(openingHour.from);
  const weekday = from.format("dddd");
  return {
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    date: from.format("DD.MM.YYYY"),
    fromTime: from.format("HH:mm"),
    toTime: norwegianTime(openingHour.to).format("HH:mm"),
  };
}
