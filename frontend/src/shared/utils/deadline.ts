import { isDeadlineOverdue } from "@boklisten/backend/shared/deadline";
import dayjs from "dayjs";

import { norwegianTime } from "@/shared/utils/dayjs";

/**
 * Formats a deadline (`YYYY-MM-DD`). It is parsed as a plain calendar day, never shifted through a
 * time zone, so it reads as the same day in every browser.
 */
export function formatDeadline(deadline: string, format = "DD/MM/YYYY"): string {
  return dayjs(deadline).format(format);
}

/** Today in Norway, `YYYY-MM-DD`, for comparing against deadlines. */
export function today(): string {
  return norwegianTime().format("YYYY-MM-DD");
}

/** Whether the deadline day has ended, by the same rule the backend reports on. */
export function isOverdue(deadline: string): boolean {
  return isDeadlineOverdue(deadline, today());
}
