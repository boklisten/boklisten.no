import type { RentPeriod } from "#shared/branch";

/**
 * The branch's rent periods still ahead of `now`, soonest first — the deadlines a book may be
 * handed out on. Dates are compared through `new Date()` because the periods arrive as ISO
 * strings over the API.
 */
export function futureRentPeriods(branch: { rentPeriods: RentPeriod[] }, now: Date): RentPeriod[] {
  return branch.rentPeriods
    .filter((period) => new Date(period.date).getTime() > now.getTime())
    .toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** The branch's future rent period matching the picked deadline, if the pick is valid. */
export function findFutureRentPeriod(
  branch: { rentPeriods: RentPeriod[] },
  deadline: Date,
  now: Date,
): RentPeriod | undefined {
  return futureRentPeriods(branch, now).find(
    (period) => new Date(period.date).getTime() === deadline.getTime(),
  );
}
