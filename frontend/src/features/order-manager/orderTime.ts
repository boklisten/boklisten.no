import { norwegianTime } from "@/shared/utils/dayjs";

/** "i dag kl. 14:05", "i går kl. 09:30", otherwise the date; the year only when it is not this one. */
export function describeOrderTime(isoTime: string): string {
  const time = norwegianTime(isoTime);
  const now = norwegianTime();
  if (time.isSame(now, "day")) {
    return `i dag kl. ${time.format("HH:mm")}`;
  }
  if (time.isSame(now.subtract(1, "day"), "day")) {
    return `i går kl. ${time.format("HH:mm")}`;
  }
  return time.format(time.isSame(now, "year") ? "D. MMM [kl.] HH:mm" : "D. MMM YYYY [kl.] HH:mm");
}
