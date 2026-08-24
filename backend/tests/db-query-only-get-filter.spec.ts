import { test } from "@japa/runner";

import { DbQueryOnlyGetFilter } from "#services/legacy/query/db-query-only-get-filter";

test.group("DbQueryOnlyGetFilter", async () => {
  const dbQueryOnlyGetFilter: DbQueryOnlyGetFilter = new DbQueryOnlyGetFilter();

  test("should throw TypeError if query is null or empty", async ({ assert }) => {
    assert.throws(() => {
      dbQueryOnlyGetFilter.getOnlyGetFilters({}, ["name"]);
    }, TypeError);
  });

  test("should return empty array if validOnlyGetParams is empty", async ({ assert }) => {
    assert.deepEqual(dbQueryOnlyGetFilter.getOnlyGetFilters({ og: "name" }, []), []);
  });

  test("should return array with correct onlyGet fields", async ({ assert }) => {
    const result = [
      { fieldName: "name", value: 1 },
      { fieldName: "age", value: 1 },
    ];

    assert.deepEqual(
      dbQueryOnlyGetFilter.getOnlyGetFilters({ og: ["name", "age"] }, ["name", "age", "desc"]),
      result,
    );
  });

  test("should throw ReferenceError if a parameter in onlyGet is not in validOnlyGetParams", async ({
    assert,
  }) => {
    assert.throws(() => {
      dbQueryOnlyGetFilter.getOnlyGetFilters({ og: "age" }, ["name"]);
    }, ReferenceError);
  });
});
