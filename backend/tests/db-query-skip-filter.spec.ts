import { test } from "@japa/runner";

import { DbQuerySkipFilter } from "#services/legacy/query/db-query-skip-filter";

test.group("DbQuerySkipFilter", async () => {
  const dbQuerySkipFilter: DbQuerySkipFilter = new DbQuerySkipFilter();

  test("should throw TypeError if query is null or empty", async ({ assert }) => {
    assert.throws(() => {
      dbQuerySkipFilter.getSkipFilter({});
    }, TypeError);
  });

  test("should return {skip: 0} when no skip parameter is in query", async ({ assert }) => {
    assert.deepEqual(dbQuerySkipFilter.getSkipFilter({ name: "hello" }), {
      skip: 0,
    });
  });

  test("should throw TypeError when skip is not a number", async ({ assert }) => {
    assert.throws(() => {
      dbQuerySkipFilter.getSkipFilter({ skip: "hello" });
    }, TypeError);
  });

  test("should throw TypeError if number is below 0", async ({ assert }) => {
    assert.throws(() => {
      dbQuerySkipFilter.getSkipFilter({ skip: "-1" });
    }, TypeError);
  });

  test('should return skip 5 when query is {skip: "5"}', async ({ assert }) => {
    assert.deepEqual(dbQuerySkipFilter.getSkipFilter({ skip: "5" }), {
      skip: 5,
    });
  });
});
