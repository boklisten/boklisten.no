import dayjs from "dayjs";

/** Formats an ISO deadline as DD/MM/YYYY (the convention used across the app). */
export function formatDeadline(isoDeadline: string): string {
  return dayjs(isoDeadline).format("DD/MM/YYYY");
}

/**
 * Whether a deadline has passed, with one day of grace (matches the old bl-admin behavior:
 * `moment().isAfter(moment(deadline).add(1, "day"))`).
 */
export function isOverdue(isoDeadline: string): boolean {
  return dayjs().isAfter(dayjs(isoDeadline).add(1, "day"));
}
