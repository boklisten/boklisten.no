import { test } from "@japa/runner";

import { DbQueryExpandFilter } from "#services/legacy/query/db-query-expand-filter";

test.group("DbQueryExpandFilter", async () => {
  const dbQueryExpandFilter = new DbQueryExpandFilter();

  test("should throw TypeError if query is empty or null", async ({ assert }) => {
    assert.throws(() => {
      dbQueryExpandFilter.getExpandFilters(null);
    }, TypeError);
  });

  test('should return empty array if "expand" keyword is not found in query', async ({
    assert,
  }) => {
    assert.deepEqual(dbQueryExpandFilter.getExpandFilters({ og: "customer" }), []);
  });

  test("should return array of expand field when present in query", async ({ assert }) => {
    assert.deepEqual(dbQueryExpandFilter.getExpandFilters({ expand: "customer" }), [
      { fieldName: "customer" },
    ]);
  });

  test("should return array of expand fields when present in query", async ({ assert }) => {
    assert.deepEqual(dbQueryExpandFilter.getExpandFilters({ expand: ["customer", "order"] }), [
      { fieldName: "customer" },
      { fieldName: "order" },
    ]);
  });
});
