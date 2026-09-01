import type { Branch } from "#shared/branch";
import type { BranchPaymentInfo } from "#shared/branch-payment-info";

export type RentPeriod = BranchPaymentInfo["rentPeriods"][number];

/**
 * The branch's rent periods still ahead of `now`, soonest first — the deadlines a book may be
 * handed out on. Dates are compared through `new Date()` since Mongo does not guarantee Date
 * instances at runtime.
 */
export function futureRentPeriods(branch: Branch, now: Date): RentPeriod[] {
  return (branch.paymentInfo?.rentPeriods ?? [])
    .filter((period) => new Date(period.date).getTime() > now.getTime())
    .toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** The branch's future rent period matching the picked deadline, if the pick is valid. */
export function findFutureRentPeriod(
  branch: Branch,
  deadline: Date,
  now: Date,
): RentPeriod | undefined {
  return futureRentPeriods(branch, now).find(
    (period) => new Date(period.date).getTime() === deadline.getTime(),
  );
}
