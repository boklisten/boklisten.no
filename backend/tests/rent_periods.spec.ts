import { test } from "@japa/runner";

import { findFutureRentPeriod, futureRentPeriods } from "#shared/rent-periods";
import type { Branch } from "#shared/branch";

const NOW = new Date("2026-08-20T12:00:00Z");
const PAST = new Date("2026-06-01T00:00:00Z");
const SOON = new Date("2026-09-01T00:00:00Z");
const LATER = new Date("2027-07-01T00:00:00Z");

function branchWithRentPeriods(dates: Date[]): Branch {
  return {
    id: "branch1",
    name: "Testskolen",
    location: { region: "Oslo" },
    paymentInfo: {
      responsible: false,
      rentPeriods: dates.map((date) => ({
        type: "semester" as const,
        date,
        maxNumberOfPeriods: 1,
        percentage: 1,
      })),
      extendPeriods: [],
    },
  };
}

test.group("futureRentPeriods()", () => {
  test("returns only periods after now, soonest first", ({ assert }) => {
    const branch = branchWithRentPeriods([LATER, PAST, SOON]);
    const periods = futureRentPeriods(branch, NOW);
    assert.deepEqual(
      periods.map((period) => period.date),
      [SOON, LATER],
    );
  });

  test("returns empty list when the branch has no payment info", ({ assert }) => {
    const branch = branchWithRentPeriods([]);
    delete branch.paymentInfo;
    assert.deepEqual(futureRentPeriods(branch, NOW), []);
  });

  test("handles dates stored as strings", ({ assert }) => {
    // Mongo does not guarantee Date instances, so the shared type lies about this at runtime
    const branch = branchWithRentPeriods([SOON.toISOString() as unknown as Date]);
    assert.lengthOf(futureRentPeriods(branch, NOW), 1);
  });
});

test.group("findFutureRentPeriod()", () => {
  test("finds the period matching the picked deadline", ({ assert }) => {
    const branch = branchWithRentPeriods([PAST, SOON, LATER]);
    assert.deepEqual(findFutureRentPeriod(branch, SOON, NOW)?.date, SOON);
  });

  test("rejects a deadline that has already passed", ({ assert }) => {
    const branch = branchWithRentPeriods([PAST, SOON]);
    assert.isUndefined(findFutureRentPeriod(branch, PAST, NOW));
  });

  test("rejects a deadline that is not one of the branch's rent periods", ({ assert }) => {
    const branch = branchWithRentPeriods([SOON]);
    assert.isUndefined(findFutureRentPeriod(branch, new Date("2026-10-15T00:00:00Z"), NOW));
  });
});
