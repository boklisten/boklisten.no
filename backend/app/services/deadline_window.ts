import { DateTime } from "luxon";

export const DEADLINE_PADDING_DAYS = 2;

// Used to mitigate time zone problems where a date is off by one or two days
export function deadlineWindow(deadline: DateTime | Date): { after: Date; before: Date } {
  const centre = DateTime.isDateTime(deadline) ? deadline : DateTime.fromJSDate(deadline);
  return {
    after: centre.minus({ days: DEADLINE_PADDING_DAYS }).toJSDate(),
    before: centre.plus({ days: DEADLINE_PADDING_DAYS }).toJSDate(),
  };
}
