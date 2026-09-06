import { test } from "@japa/runner";

import { isDeadlineOverdue } from "#shared/deadline";

const DEADLINE = new Date("2026-07-01T00:00:00.000Z");

test.group("isDeadlineOverdue", () => {
  test("is not overdue on the deadline day or the day after", ({ assert }) => {
    assert.isFalse(isDeadlineOverdue(DEADLINE, new Date("2026-07-01T12:00:00.000Z")));
    assert.isFalse(isDeadlineOverdue(DEADLINE, new Date("2026-07-02T00:00:00.000Z")));
  });

  test("is overdue once the day of grace has passed", ({ assert }) => {
    assert.isTrue(isDeadlineOverdue(DEADLINE, new Date("2026-07-02T00:00:00.001Z")));
    assert.isTrue(isDeadlineOverdue(DEADLINE.toISOString(), new Date("2026-08-01T00:00:00.000Z")));
  });
});
