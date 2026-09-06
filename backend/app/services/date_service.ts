import moment from "moment-timezone";

moment.tz.setDefault("Europe/London");

function utcToLocalTimeString(utcDate: Date | string, location: string): string {
  return moment.tz(utcDate, location).format("YYYY-MM-DDTHH:mm:ss.SSSZ");
}

function toPrintFormat(date: Date | string, location: string): string {
  return moment.tz(date, location).format("DD.MM.YY");
}

function toEndOfDay(date: Date | string, location: string): Date {
  return moment.tz(date, location).endOf("day").toDate();
}

function format(date: Date | string, location: string, formatString: string): string {
  return moment.tz(date, location).format(formatString);
}

function between(date: Date, from: Date, to: Date, location: string): boolean {
  return moment.tz(date, location).isBetween(from, to);
}

function betweenHours(date: Date, fromHour: number, toHour: number, location: string): boolean {
  const from = moment.tz(location).hour(fromHour).minute(0).second(0);
  const to = moment.tz(location).hour(toHour).minute(0).second(0);

  return between(date, from.toDate(), to.toDate(), location);
}

function isOver18(birthday: Date | string): boolean {
  const eightTeenYearsAgo = moment().subtract(18, "years");
  return moment(birthday).isSameOrBefore(eightTeenYearsAgo, "day");
}

function toDate(dateString: string, formatString: string, location: string) {
  return moment.tz(dateString, formatString, location).toDate();
}

/*
 * DateService is a wrapper around momentjs to have a
 * single place for localization of time zones
 */
export const DateService = {
  utcToLocalTimeString,
  toPrintFormat,
  toEndOfDay,
  format,
  between,
  betweenHours,
  isOver18,
  toDate,
};
