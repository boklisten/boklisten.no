import { test } from "@japa/runner";

import { isDeadlineOverdue } from "#shared/deadline";

test.group("isDeadlineOverdue", () => {
  test("is not overdue before or on the deadline day", ({ assert }) => {
    assert.isFalse(isDeadlineOverdue("2026-07-01", "2026-06-30"));
    assert.isFalse(isDeadlineOverdue("2026-07-01", "2026-07-01"));
  });

  test("is overdue from the day after the deadline", ({ assert }) => {
    assert.isTrue(isDeadlineOverdue("2026-07-01", "2026-07-02"));
    assert.isTrue(isDeadlineOverdue("2026-07-01", "2027-01-01"));
  });
});
