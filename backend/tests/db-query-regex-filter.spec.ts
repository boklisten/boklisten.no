import { test } from "@japa/runner";

import { DbQueryRegexFilter } from "#services/legacy/query/db-query-regex-filter";

test.group("DbQueryRegexFilter", async () => {
  const dbQueryRegexFilter: DbQueryRegexFilter = new DbQueryRegexFilter();

  test("should return empty array when searchString is empty", async ({ assert }) => {
    assert.deepEqual(dbQueryRegexFilter.getRegexFilters({ name: "hello" }, []), []);
  });

  test("should throw TypeError when search fieldName is under 3 characters long", async ({
    assert,
  }) => {
    assert.throws(() => {
      dbQueryRegexFilter.getRegexFilters({ s: "si" }, ["name"]);
    }, TypeError);
  });

  test("should return empty array when validSearchParams is empty", async ({ assert }) => {
    assert.deepEqual(dbQueryRegexFilter.getRegexFilters({ s: "hello" }, []), []);
  });

  test('should return array like [{name: {$regex: "sig", $options: "imx"}}]', async ({
    assert,
  }) => {
    const result = [{ fieldName: "name", op: { $regex: "sig", $options: "imx" } }];
    assert.deepEqual(dbQueryRegexFilter.getRegexFilters({ s: "sig" }, ["name"]), result);
  });

  test("should return array containing regexfilter objects for all params in validRegexParams", async ({
    assert,
  }) => {
    const result = [
      { fieldName: "name", op: { $regex: "hello", $options: "imx" } },
      { fieldName: "message", op: { $regex: "hello", $options: "imx" } },
      { fieldName: "info", op: { $regex: "hello", $options: "imx" } },
      { fieldName: "desc", op: { $regex: "hello", $options: "imx" } },
    ];

    const validRegexParams = ["name", "message", "info", "desc"];
    const query = { s: "hello" };

    assert.deepEqual(dbQueryRegexFilter.getRegexFilters(query, validRegexParams), result);
  });
});
