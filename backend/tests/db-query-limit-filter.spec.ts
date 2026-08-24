import { test } from "@japa/runner";

import { DbQueryLimitFilter } from "#services/legacy/query/db-query-limit-filter";

test.group("DbQueryLimitFilter", async () => {
  const dbQueryLimitFilter = new DbQueryLimitFilter();

  test("should throw error if query is empty or null", async ({ assert }) => {
    assert.throws(() => {
      dbQueryLimitFilter.getLimitFilter({});
    }, TypeError);
  });

  test("should return {limit: 0} if no limit is found in query", async ({ assert }) => {
    assert.deepEqual(dbQueryLimitFilter.getLimitFilter({ name: "Albert" }), {
      limit: 0,
    });
  });

  test("should throw TypeError if limit is not a valid number", async ({ assert }) => {
    assert.throws(() => {
      dbQueryLimitFilter.getLimitFilter({ limit: "not a number" });
    }, TypeError);
  });
});
