import { ACTIVITY_RESOLUTION_MINUTES } from "@boklisten/backend/shared/user-activity";

import { norwegianTime } from "@/shared/utils/dayjs";

const RESOLUTION_MS = ACTIVITY_RESOLUTION_MINUTES * 60 * 1000;

/**
 * "Sist aktiv" as a relative time. The backend refreshes the stamp only every
 * `ACTIVITY_RESOLUTION_MINUTES`, so a stamp younger than that is a window, not a moment: saying
 * "7 minutter siden" to someone who clicked five seconds ago would be wrong.
 */
export function lastActiveLabel(lastActive: string | null): string {
  if (lastActive === null) {
    return "aldri";
  }
  if (Date.now() - new Date(lastActive).getTime() < RESOLUTION_MS) {
    return `< ${ACTIVITY_RESOLUTION_MINUTES} minutter siden`;
  }
  return norwegianTime(lastActive).fromNow();
}
