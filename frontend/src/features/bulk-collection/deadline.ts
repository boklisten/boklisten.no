import { isDeadlineOverdue } from "@boklisten/backend/shared/deadline";

import { norwegianTime } from "@/shared/utils/dayjs";

/** Formats an ISO deadline as DD/MM/YYYY (the convention used across the app). */
export function formatDeadline(isoDeadline: string): string {
  return norwegianTime(isoDeadline).format("DD/MM/YYYY");
}

/** Whether a deadline has passed, by the same one-day-of-grace rule the backend reports on. */
export function isOverdue(isoDeadline: string): boolean {
  return isDeadlineOverdue(isoDeadline, new Date());
}
