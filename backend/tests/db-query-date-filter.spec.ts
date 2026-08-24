import { test } from "@japa/runner";
import moment from "moment";

import { DbQueryDateFilter } from "#services/legacy/query/db-query-date-filter";

test.group("DbQueryDateFilter", async () => {
  const dbQueryDateFilter: DbQueryDateFilter = new DbQueryDateFilter();
  const validDateFormat = "DDMMYYYYHHmm";

  test("should throw TypeError if parameters are empty", async ({ assert }) => {
    assert.throws(() => {
      dbQueryDateFilter.getDateFilters({}, []);
    }, TypeError);
  });

  test("should return empty array if valid params is empty", async ({ assert }) => {
    assert.deepEqual(dbQueryDateFilter.getDateFilters({ something: "aas" }, []), []);
  });

  test("should return empty array if query does not include any of the valid params", async ({
    assert,
  }) => {
    assert.deepEqual(dbQueryDateFilter.getDateFilters({ something: "" }, ["creationTime"]), []);
  });

  test("should return filter with correct filedName", async ({ assert }) => {
    const fieldName = "creationDate";
    const query = { creationDate: "010120010000" };
    const momentDate = moment(query.creationDate, validDateFormat, true).toDate();

    assert.deepEqual(dbQueryDateFilter.getDateFilters(query, [fieldName]), [
      { fieldName: fieldName, op: { $eq: momentDate } },
    ]);
  });

  test("should throw SyntaxError when date is {$self}")
    .with(["212121", "10notvalid", "kkk", "albert", "330120010000", "2101200300001"])
    .run(({ assert }, date) => {
      const query = { creationTime: "" };
      query.creationTime = date;

      assert.throws(() => {
        dbQueryDateFilter.getDateFilters(query, ["creationTime"]);
      }, SyntaxError);
    });

  test("should resolve with correct $eq date filter for {creationTime}")
    .with([{ creationTime: "201220180000" }, { creationTime: "010720180000" }])
    .run(({ assert }, validQuery) => {
      const dateString = validQuery.creationTime;
      const isoDate = moment(dateString, validDateFormat, true).toDate();

      assert.deepEqual(dbQueryDateFilter.getDateFilters(validQuery, ["creationTime"]), [
        { fieldName: "creationTime", op: { $eq: isoDate } },
      ]);
    });

  test("should resolve with correct {op} date filter")
    .with([
      { creationTime: "<201220180000", op: "$lt" },
      { creationTime: ">010720180000", op: "$gt" },
    ])
    .run(({ assert }, validQuery) => {
      const dateString = validQuery.creationTime.slice(1, validQuery.creationTime.length);
      const isoDate = moment(dateString, validDateFormat, true).toDate();

      const expectedOp = {};

      // @ts-expect-error fixme: auto ignored
      expectedOp[validQuery.op] = isoDate;

      assert.deepEqual(dbQueryDateFilter.getDateFilters(validQuery, ["creationTime"]), [
        { fieldName: "creationTime", op: expectedOp },
      ]);
    });

  test("should resolve with correct date range filter for {creationTime}")
    .with([
      { creationTime: [">101020100000", "<171020100000"] },
      { creationTime: [">111220120000", "<121220130000"] },
      { creationTime: [">111220120000", "<101220150000"] },
    ])
    .run(({ assert }, validQuery) => {
      // @ts-expect-error fixme: auto ignored
      const gtDateString = validQuery.creationTime[0].slice(1);

      // @ts-expect-error fixme: auto ignored
      const ltDateString = validQuery.creationTime[1].slice(1);

      const gtIsoDate = moment(gtDateString, validDateFormat, true).toDate();
      const ltIsoDate = moment(ltDateString, validDateFormat, true).toDate();

      assert.deepEqual(dbQueryDateFilter.getDateFilters(validQuery, ["creationTime"]), [
        {
          fieldName: "creationTime",
          op: { $gt: gtIsoDate, $lt: ltIsoDate },
        },
      ]);
    });
});
