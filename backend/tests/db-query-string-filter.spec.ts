import { test } from "@japa/runner";

import { DbQueryStringFilter } from "#services/legacy/query/db-query-string-filter";

test.group("DbQueryStringFilter", async () => {
  const dbQueryStringFilter: DbQueryStringFilter = new DbQueryStringFilter();

  test("should return empty array if query is valid and validStringParams is empty", async ({
    assert,
  }) => {
    assert.deepEqual(dbQueryStringFilter.getStringFilters({ name: "testerman" }, []), []);
  });

  test("should throw TypeError if query is empty", async ({ assert }) => {
    assert.throws(() => {
      dbQueryStringFilter.getStringFilters({}, ["name"]);
    }, TypeError);
  });

  test("should throw TypeError if parameter is not a valid string", async ({ assert }) => {
    assert.throws(() => {
      dbQueryStringFilter.getStringFilters({ name: { test: {} } }, ["name"]);
    }, TypeError);
  });

  test("should not change values in query that are not in ValidStringParams", async ({
    assert,
  }) => {
    const result = [{ fieldName: "name", value: "albert" }];
    assert.deepEqual(
      dbQueryStringFilter.getStringFilters({ name: "albert", phone: "123" }, ["name"]),
      result,
    );
  });

  test("should return correct array given valid input", async ({ assert }) => {
    const query = {
      name: "billy bob",
      desc: "hello there this is bob",
      age: "10",
      branch: ["123", "83ax"],
    };
    const result = [
      { fieldName: "name", value: "billy bob" },
      { fieldName: "desc", value: "hello there this is bob" },
      { fieldName: "branch", value: ["123", "83ax"] },
    ];

    assert.deepEqual(
      dbQueryStringFilter.getStringFilters(query, ["name", "desc", "title", "branch"]),
      result,
    );
  });
});
