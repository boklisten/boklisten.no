import dayjs from "dayjs";
import "dayjs/locale/nb";
import customParseFormat from "dayjs/plugin/customParseFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

export const NORWEGIAN_TIMEZONE = "Europe/Oslo";

dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("nb");
dayjs.tz.setDefault(NORWEGIAN_TIMEZONE);

export function norwegianTime(date?: dayjs.ConfigType) {
  return dayjs(date).tz(NORWEGIAN_TIMEZONE);
}

export function parseNorwegianTime(date: string, time: string) {
  return dayjs.tz(`${date}T${time}`, NORWEGIAN_TIMEZONE);
}
