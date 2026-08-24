import { test } from "@japa/runner";
import mongoose from "mongoose";

import { DbQueryObjectIdFilter } from "#services/legacy/query/db-query-object-id-filter";

test.group("DbQueryObjectIdFilter", async () => {
  const dbQueryObjectIdFilter: DbQueryObjectIdFilter = new DbQueryObjectIdFilter();

  test("should return empty array if query is valid and validObjectIdParams is empty", async ({
    assert,
  }) => {
    assert.deepEqual(
      dbQueryObjectIdFilter.getObjectIdFilters({ name: "5c2e0e5bb311ba0701f15967" }, []),
      [],
    );
  });

  test("should throw TypeError if query is empty", async ({ assert }) => {
    assert.throws(() => {
      dbQueryObjectIdFilter.getObjectIdFilters({}, ["id"]);
    }, TypeError);
  });

  test("should throw error when both query and validParams are empty ", async ({ assert }) => {
    assert.throws(() => {
      dbQueryObjectIdFilter.getObjectIdFilters({}, []);
    }, TypeError);
  });

  test("should throw Error if parameter is not a valid object-id", async ({ assert }) => {
    assert.throws(() => {
      dbQueryObjectIdFilter.getObjectIdFilters({ id: { test: {} } }, ["id"]);
    }, Error);
  });

  test("should not change values in query that are not in ValidObjectIdParams", async ({
    assert,
  }) => {
    const result = [
      {
        fieldName: "id",
        value: [
          "5c2e0e5bb311ba0701f15967",
          new mongoose.Types.ObjectId("5c2e0e5bb311ba0701f15967"),
        ],
      },
    ];
    assert.deepEqual(
      dbQueryObjectIdFilter.getObjectIdFilters({ id: "5c2e0e5bb311ba0701f15967" }, ["id"]),
      result,
    );
  });

  test("should return correct array given valid input", async ({ assert }) => {
    const query = {
      id: "5c2e0e5bb311ba0701f15967",
      customer: "5c2e0e5bb311ba0701f15967",
      branch: ["5c2e0e5bb311ba0701f15968", "5c2e0e5bb311ba0701f15967"],
    };
    const result = [
      {
        fieldName: "id",
        value: [
          "5c2e0e5bb311ba0701f15967",
          new mongoose.Types.ObjectId("5c2e0e5bb311ba0701f15967"),
        ],
      },
      {
        fieldName: "customer",
        value: [
          "5c2e0e5bb311ba0701f15967",
          new mongoose.Types.ObjectId("5c2e0e5bb311ba0701f15967"),
        ],
      },
      {
        fieldName: "branch",
        value: [
          "5c2e0e5bb311ba0701f15968",
          new mongoose.Types.ObjectId("5c2e0e5bb311ba0701f15968"),
          "5c2e0e5bb311ba0701f15967",
          new mongoose.Types.ObjectId("5c2e0e5bb311ba0701f15967"),
        ],
      },
    ];

    assert.deepEqual(
      dbQueryObjectIdFilter.getObjectIdFilters(query, ["id", "customer", "branch"]),
      result,
    );
  });
});
