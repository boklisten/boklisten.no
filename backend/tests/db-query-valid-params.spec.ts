import { test } from "@japa/runner";

import type { ValidParameter } from "#services/legacy/query/db-query-valid-params";
import { DbQueryValidParams } from "#services/legacy/query/db-query-valid-params";

test.group("DbQueryValidParams", async () => {
  test("should return empty array if no valid NumberParams is set", async ({ assert }) => {
    const dbQueryValidParams: DbQueryValidParams = new DbQueryValidParams([]);
    assert.deepEqual(dbQueryValidParams.getValidNumberParams(), []);
  });

  test('should return array like ["name", "desc"] ', async ({ assert }) => {
    const validParams: ValidParameter[] = [];
    validParams.push({ fieldName: "age", type: "number" });
    validParams.push({ fieldName: "price", type: "number" });
    const dbQueryValidParams: DbQueryValidParams = new DbQueryValidParams(validParams);
    const result = ["age", "price"];

    assert.deepEqual(dbQueryValidParams.getValidNumberParams(), result);
  });

  test("should return empty array if none of the validParams are of type number", async ({
    assert,
  }) => {
    const validParams: ValidParameter[] = [{ fieldName: "name", type: "string" }];
    const dbQueryValidParams: DbQueryValidParams = new DbQueryValidParams(validParams);
    assert.deepEqual(dbQueryValidParams.getValidNumberParams(), []);
  });

  test("should return string array with names of all validParams with type string", async ({
    assert,
  }) => {
    const validParams: ValidParameter[] = [
      { fieldName: "name", type: "string" },
      { fieldName: "desc", type: "string" },
    ];
    const dbQuertyValidParams: DbQueryValidParams = new DbQueryValidParams(validParams);
    const result = ["name", "desc"];

    assert.deepEqual(dbQuertyValidParams.getValidStringParams(), result);
  });

  test('should return empty array if no validParams with type "string" is given', async ({
    assert,
  }) => {
    const validParams: ValidParameter[] = [{ fieldName: "age", type: "number" }];

    const dbQueryValidParams: DbQueryValidParams = new DbQueryValidParams(validParams);

    assert.deepEqual(dbQueryValidParams.getValidStringParams(), []);
  });
});
