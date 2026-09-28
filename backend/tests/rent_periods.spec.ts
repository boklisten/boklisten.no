import { test } from "@japa/runner";

import { findFutureRentPeriod, futureRentPeriods } from "#shared/rent-periods";
import type { Branch } from "#shared/branch";
import { branchDto } from "#tests/branch_fixtures";

const TODAY = "2026-08-20";
const PAST = "2026-07-01";
const SOON = "2026-09-01";
const LATER = "2027-07-01";

function branchWithRentPeriods(dates: string[]): Branch {
  return branchDto({
    rentPeriods: dates.map((date) => ({
      type: "semester" as const,
      date,
      maxNumberOfPeriods: 1,
      percentage: 1,
    })),
  });
}

test.group("futureRentPeriods()", () => {
  test("returns only periods after today, soonest first", ({ assert }) => {
    const branch = branchWithRentPeriods([LATER, PAST, SOON]);
    const periods = futureRentPeriods(branch, TODAY);
    assert.deepEqual(
      periods.map((period) => period.date),
      [SOON, LATER],
    );
  });

  test("leaves out a period due today", ({ assert }) => {
    assert.deepEqual(futureRentPeriods(branchWithRentPeriods([TODAY]), TODAY), []);
  });

  test("returns empty list when the branch has no rent periods", ({ assert }) => {
    assert.deepEqual(futureRentPeriods(branchWithRentPeriods([]), TODAY), []);
  });
});

test.group("findFutureRentPeriod()", () => {
  test("finds the period matching the picked deadline", ({ assert }) => {
    const branch = branchWithRentPeriods([PAST, SOON, LATER]);
    assert.equal(findFutureRentPeriod(branch, SOON, TODAY)?.date, SOON);
  });

  test("rejects a deadline that has already passed", ({ assert }) => {
    const branch = branchWithRentPeriods([PAST, SOON]);
    assert.isUndefined(findFutureRentPeriod(branch, PAST, TODAY));
  });

  test("rejects a deadline that is not one of the branch's rent periods", ({ assert }) => {
    const branch = branchWithRentPeriods([SOON]);
    assert.isUndefined(findFutureRentPeriod(branch, "2026-10-15", TODAY));
  });
});
