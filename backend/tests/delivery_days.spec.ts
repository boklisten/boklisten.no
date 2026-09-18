import { test } from "@japa/runner";
import { DateTime } from "luxon";

import { deliveryDays } from "#services/application_config";

test.group("deliveryDays", () => {
  test("is short {reason}")
    .with([
      { reason: "on the first day of the autumn season", now: "2026-08-05T00:30:00" },
      { reason: "in the middle of the autumn season", now: "2026-08-20T12:00:00" },
      { reason: "on the last day of the autumn season", now: "2026-09-10T23:30:00" },
      { reason: "on the first day of the spring season", now: "2026-01-07T08:00:00" },
      { reason: "on the last day of the spring season", now: "2026-02-08T23:59:59" },
    ])
    .run(({ assert }, { now }) => {
      assert.equal(deliveryDays(DateTime.fromISO(now)), 3);
    });

  test("is long {reason}")
    .with([
      { reason: "the day before the autumn season", now: "2026-08-04T23:59:59" },
      { reason: "the day after the autumn season", now: "2026-09-11T00:00:00" },
      { reason: "the day before the spring season", now: "2026-01-06T12:00:00" },
      { reason: "the day after the spring season", now: "2026-02-09T00:00:00" },
      { reason: "in the summer holiday", now: "2026-07-01T12:00:00" },
      { reason: "in the autumn term", now: "2026-11-15T12:00:00" },
    ])
    .run(({ assert }, { now }) => {
      assert.equal(deliveryDays(DateTime.fromISO(now)), 7);
    });
});
