import { test } from "@japa/runner";

import { DbQueryNumberFilter } from "#services/legacy/query/db-query-number-filter";

test.group("DbQueryNumberFilter", async () => {
  const dbQueryNumberFilter: DbQueryNumberFilter = new DbQueryNumberFilter();

  test("should return empty array when the ValidParams are empty", async ({ assert }) => {
    assert.deepEqual(
      dbQueryNumberFilter.getNumberFilters({ title: "test title", name: "hello" }, []),
      [],
    );
  });

  test("should return an empty array if none of the validNumberParams are included in the query", async ({
    assert,
  }) => {
    assert.deepEqual(
      dbQueryNumberFilter.getNumberFilters({ title: "test", name: "bill" }, ["age", "price"]),
      [],
    );
  });

  test("should throw {error} when {reason}")
    .with([
      { reason: "no input is given", query: {}, validParams: [], error: TypeError },
      { reason: "query is null", query: null, validParams: ["age"], error: TypeError },
      { reason: "query is empty", query: {}, validParams: ["age"], error: TypeError },
      {
        reason: "number is not valid",
        query: { age: ">10>1" },
        validParams: ["age"],
        error: TypeError,
      },
      {
        reason: "wrong input is given",
        query: { price: "*10" },
        validParams: ["price"],
        error: TypeError,
      },
      {
        reason: "combining eq operator with lessThan operator",
        query: { age: ["<40", "30"] },
        validParams: ["age"],
        error: SyntaxError,
      },
      {
        reason: "combining eq operator with greaterThan operator",
        query: { age: [">40", "30"] },
        validParams: ["age"],
        error: SyntaxError,
      },
    ])
    .run(({ assert }, { query, validParams, error }) => {
      assert.throws(() => {
        dbQueryNumberFilter.getNumberFilters(query, validParams);
      }, error);
    });

  test("should parse {reason}")
    .with([
      {
        reason: "a lessThan operator",
        query: { age: "<60" },
        expected: [{ fieldName: "age", op: { $lt: 60 } }],
      },
      {
        reason: "combined lessThan and greaterThan operators",
        query: { age: ["<86", ">12"] },
        expected: [{ fieldName: "age", op: { $lt: 86, $gt: 12 } }],
      },
      {
        reason: "a plain number as an eq operator",
        query: { age: "10" },
        expected: [{ fieldName: "age", op: { $eq: 10 } }],
      },
    ])
    .run(({ assert }, { query, expected }) => {
      assert.deepEqual(dbQueryNumberFilter.getNumberFilters(query, ["age"]), expected);
    });
});
