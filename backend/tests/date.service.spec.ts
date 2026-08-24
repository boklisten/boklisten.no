import { test } from "@japa/runner";
import moment from "moment-timezone";

import { DateService } from "#services/legacy/date.service";

test.group("DateService", async () => {
  test("should convert {reason} to Oslo local time")
    .with([
      {
        reason: "a UTC Date in winter time",
        input: new Date(Date.UTC(2019, 11, 20)),
        expected: "2019-12-20T01:00:00.000+01:00",
      },
      {
        reason: "a datestring across midnight in winter time",
        input: "2019-12-19T23:00:00.000+00:00",
        expected: "2019-12-20T00:00:00.000+01:00",
      },
      {
        reason: "a datestring across midnight in summer time",
        input: "2020-06-30T22:00:00.000+00:00",
        expected: "2020-07-01T00:00:00.000+02:00",
      },
      {
        reason: "a datestring within the same day in winter time",
        input: "2018-12-20T00:00:00.000+00:00",
        expected: "2018-12-20T01:00:00.000+01:00",
      },
    ])
    .run(({ assert }, { input, expected }) => {
      assert.equal(DateService.utcToLocalTimeString(input, "Europe/Oslo"), expected);
    });

  test("should be possible to display returned string on local format", async ({ assert }) => {
    const utcDate = new Date(Date.UTC(2019, 11, 20));

    assert.equal(
      DateService.toPrintFormat(
        DateService.utcToLocalTimeString(utcDate, "Europe/Oslo"),
        "Europe/Oslo",
      ),
      "20.12.19",
    );
  });

  test("should be possible to convert from timezone America/Los_Angeles to Europe/Oslo", async ({
    assert,
  }) => {
    const utcDate = new Date(Date.UTC(2018, 11, 20));

    const americaDate = DateService.utcToLocalTimeString(utcDate, "America/Los_Angeles");

    assert.equal(
      DateService.utcToLocalTimeString(americaDate, "Europe/Oslo"),
      "2018-12-20T01:00:00.000+01:00",
    );
  });

  test("should return date on print format", async ({ assert }) => {
    const date = "2019-12-20T22:00:00.000+01:00";
    assert.equal(DateService.toPrintFormat(date, "Europe/Oslo"), "20.12.19");
  });

  test("should return a time with added 23:59 hours", async ({ assert }) => {
    const date = "2020-06-30T22:00:00.000+00:00";
    assert.equal(
      DateService.toEndOfDay(date, "Europe/Oslo").toISOString(),
      "2020-07-01T21:59:59.999Z",
    );
  });

  test("should format date with a custom format string", async ({ assert }) => {
    const date = "2020-01-01T10:12:20.000+01:00";
    assert.equal(
      DateService.format(date, "Europe/Oslo", "DD.MM.YYYY HH:mm:ss"),
      "01.01.2020 10:12:20",
    );
  });

  test("should return true if date is between from date and to date", async ({ assert }) => {
    const date = new Date(1900, 1, 10, 10, 12, 13);
    const from = new Date(1900, 1, 10, 9);
    const to = new Date(1900, 1, 10, 20);

    // oxlint-disable-next-line no-unused-expressions
    assert.isTrue(DateService.between(date, from, to, "Europe/Oslo"));
  });

  test("should return false if birthday is under 18", async ({ assert }) => {
    const birthdays = [
      moment().subtract(1, "day").toDate(),
      moment().subtract(1, "year").toDate(),
      moment().subtract(17, "years").toDate(),
      moment().subtract(18, "years").add(1, "day").toDate(),
      moment().toDate(),
    ];

    for (const birthday of birthdays) {
      // oxlint-disable-next-line no-unused-expressions
      assert.isFalse(DateService.isOver18(birthday));
    }
  });

  test("should return true if birthday is over 18", async ({ assert }) => {
    const birthdays = [
      moment().subtract(98, "years").toDate(),
      moment().subtract(19, "year").toDate(),
      moment().subtract(21, "years").toDate(),
      moment().subtract(18, "years").toDate(),
    ];

    for (const birthday of birthdays) {
      // oxlint-disable-next-line no-unused-expressions
      assert.isTrue(DateService.isOver18(birthday));
    }
  });

  test("should return true if date is between from hour and to hour", async ({ assert }) => {
    const date = moment().tz("Europe/Oslo").hour(12).minute(15).seconds(22).toDate();

    // oxlint-disable-next-line no-unused-expressions
    assert.isTrue(DateService.betweenHours(date, 8, 18, "Europe/Oslo"));
  });

  test("should return false if date is not between from hour and to hour", async ({ assert }) => {
    const date = moment().tz("Europe/Oslo").hour(7).minute(15).seconds(22).toDate();

    // oxlint-disable-next-line no-unused-expressions
    assert.isFalse(DateService.betweenHours(date, 8, 18, "Europe/Oslo"));
  });
});
