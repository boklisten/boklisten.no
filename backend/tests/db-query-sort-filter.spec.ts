import { test } from "@japa/runner";

import { DbQuerySortFilter } from "#services/legacy/query/db-query-sort-filter";

test.group("DbQuerySortFilter", async () => {
  const dbQuerySortFilter: DbQuerySortFilter = new DbQuerySortFilter();

  test("should throw TypeError when query is null or empty", async ({ assert }) => {
    assert.throws(() => {
      dbQuerySortFilter.getSortFilters({}, ["hello"]);
    }, TypeError);
  });

  test("should return empty array if query does not have the sort object", async ({ assert }) => {
    assert.deepEqual(dbQuerySortFilter.getSortFilters({ name: "hello" }, ["age"]), []);
  });

  test("should throw ReferenceError if none of the sort params are in the ValidSortParams", async ({
    assert,
  }) => {
    assert.throws(() => {
      dbQuerySortFilter.getSortFilters({ sort: ["-age", "name"] }, ["desc"]);
    }, ReferenceError);
  });

  test("should return correct array with the given input", async ({ assert }) => {
    const result = [
      { fieldName: "name", direction: 1 },
      { fieldName: "age", direction: -1 },
    ];

    assert.deepEqual(
      dbQuerySortFilter.getSortFilters({ sort: ["name", "-age"] }, ["name", "age"]),
      result,
    );
  });
});
