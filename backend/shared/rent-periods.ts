import type { RentPeriod } from "#shared/branch";

/**
 * The branch's rent periods whose deadline is after `today` (`YYYY-MM-DD`), soonest first — the
 * deadlines a book may be handed out on. A book is never handed out on the day it is due.
 */
export function futureRentPeriods(
  branch: { rentPeriods: RentPeriod[] },
  today: string,
): RentPeriod[] {
  return branch.rentPeriods
    .filter((period) => period.date > today)
    .toSorted((a, b) => a.date.localeCompare(b.date));
}

/** The branch's future rent period matching the picked deadline, if the pick is valid. */
export function findFutureRentPeriod(
  branch: { rentPeriods: RentPeriod[] },
  deadline: string,
  today: string,
): RentPeriod | undefined {
  return futureRentPeriods(branch, today).find((period) => period.date === deadline);
}
