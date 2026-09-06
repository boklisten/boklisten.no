import { test } from "@japa/runner";

import type { ValidParameter } from "#services/legacy/query/db-query-valid-params";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";

test.group("DbQueryBuilder", async () => {
  const dbQueryBuilder = new SEDbQueryBuilder();

  test("should throw return empty SeDbQuery object if no query is given", async ({ assert }) => {
    assert.deepEqual(
      dbQueryBuilder.getDbQuery({}, [{ fieldName: "name", type: "string" }]),
      new SEDbQuery(),
    );
  });

  test("should return SeDbQuery with correct filters", async ({ assert }) => {
    const result = new SEDbQuery();
    result.numberFilters = [
      { fieldName: "age", op: { $gt: 12, $lt: 60 } },
      { fieldName: "price", op: { $eq: 120 } },
    ];

    const validParams: ValidParameter[] = [
      { fieldName: "name", type: "string" },
      { fieldName: "age", type: "number" },
      { fieldName: "price", type: "number" },
    ];

    assert.deepEqual(
      dbQueryBuilder.getDbQuery({ age: [">12", "<60"], price: "120" }, validParams),
      result,
    );
  });

  test("should throw TypeError when a number field is not a number", async ({ assert }) => {
    assert.throws(() => {
      dbQueryBuilder.getDbQuery({ age: "albert" }, [{ fieldName: "age", type: "number" }]);
    }, TypeError);
  });
});
