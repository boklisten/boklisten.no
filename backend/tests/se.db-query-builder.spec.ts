import { test } from "@japa/runner";

import { ValidParameter } from "#services/legacy/query/db-query-valid-params";
import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { SEDbQueryBuilder } from "#services/legacy/query/se.db-query-builder";

test.group("DbQueryBuilder", async () => {
  const dbQueryBuilder = new SEDbQueryBuilder();

  test("should throw return empty SeDbQuery object if no query is given", async ({ assert }) => {
    assert.deepEqual(
      dbQueryBuilder.getDbQuery({}, [{ fieldName: "name", type: "string" }]),
      new SEDbQuery(),
    );
  });

  test("should return SedbQuery with skip equal to 5", async ({ assert }) => {
    const result = new SEDbQuery();
    result.skipFilter = { skip: 5 };

    assert.deepEqual(dbQueryBuilder.getDbQuery({ skip: "5" }, []), result);
  });

  test("should return SeDbQuery with limit to 4", async ({ assert }) => {
    const result = new SEDbQuery();
    result.limitFilter = { limit: 4 };
    assert.deepEqual(dbQueryBuilder.getDbQuery({ limit: "4" }, []), result);
  });

  test("should return SeDbQuery with correct filters", async ({ assert }) => {
    const result = new SEDbQuery();
    result.numberFilters = [
      { fieldName: "age", op: { $gt: 12, $lt: 60 } },
      { fieldName: "price", op: { $eq: 120 } },
    ];

    result.limitFilter = { limit: 3 };
    result.onlyGetFilters = [{ fieldName: "name", value: 1 }];

    const validParams: ValidParameter[] = [
      { fieldName: "name", type: "string" },
      { fieldName: "age", type: "number" },
      { fieldName: "price", type: "number" },
    ];

    assert.deepEqual(
      dbQueryBuilder.getDbQuery(
        { age: [">12", "<60"], price: "120", limit: "3", og: "name" },
        validParams,
      ),
      result,
    );
  });

  test("should throw TypeError when limit is under 0", async ({ assert }) => {
    assert.throws(() => {
      dbQueryBuilder.getDbQuery({ limit: "-6" }, []);
    }, TypeError);
  });

  test("should throw TypeError when a number field is not a number", async ({ assert }) => {
    assert.throws(() => {
      dbQueryBuilder.getDbQuery({ age: "albert" }, [{ fieldName: "age", type: "number" }]);
    }, TypeError);
  });

  test("should throw ReferenceError when a field is not in validQueryParams", async ({
    assert,
  }) => {
    assert.throws(() => {
      dbQueryBuilder.getDbQuery({ og: ["name", "age"] }, [{ fieldName: "age", type: "number" }]);
    }, ReferenceError);
  });
});
