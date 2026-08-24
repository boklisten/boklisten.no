import { test } from "@japa/runner";

import { DbQueryBooleanFilter } from "#services/legacy/query/db-query-boolean-filter";

test.group("DbQueryBooleanFilter", async () => {
  const dbQueryBooleanFilter: DbQueryBooleanFilter = new DbQueryBooleanFilter();

  test("should throw TypeError if query is empty or null", async ({ assert }) => {
    assert.throws(() => {
      dbQueryBooleanFilter.getBooleanFilters({}, ["hello"]);
    }, TypeError);
  });

  test("should return empty filter if ValidBoomeanParams array is empty", async ({ assert }) => {
    assert.deepEqual(dbQueryBooleanFilter.getBooleanFilters({ name: "albert" }, []), []);
  });

  test('should return array of [{fieldName: "haveEaten", value: true"}]', async ({ assert }) => {
    const result = [{ fieldName: "haveEaten", value: true }];
    assert.deepEqual(
      dbQueryBooleanFilter.getBooleanFilters({ haveEaten: "true" }, ["haveEaten"]),
      result,
    );
  });

  test("should throw TypeError if a value that is can not be parsed to boolean is given", async ({
    assert,
  }) => {
    assert.throws(() => {
      dbQueryBooleanFilter.getBooleanFilters({ haveEaten: "hello" }, ["haveEaten"]);
    }, TypeError);
  });

  test("should return array that includes all params that are of boolean type in query", async ({
    assert,
  }) => {
    const result = [
      { fieldName: "confirmed", value: true },
      { fieldName: "hasCar", value: false },
      { fieldName: "isOld", value: true },
    ];

    assert.deepEqual(
      dbQueryBooleanFilter.getBooleanFilters(
        { confirmed: "true", hasCar: "false", isOld: "true" },
        ["confirmed", "hasCar", "isOld", "haveChildren"],
      ),
      result,
    );
  });
});
