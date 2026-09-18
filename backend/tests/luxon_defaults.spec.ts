import { test } from "@japa/runner";
import { DateTime, Settings } from "luxon";

/** The preload in start/luxon.ts is what every date-formatting call site relies on. */
test.group("Luxon defaults", () => {
  test("the app runs in Norwegian local time whatever the server's clock says", ({ assert }) => {
    assert.equal(Settings.defaultZone.name, "Europe/Oslo");
    assert.equal(DateTime.now().zoneName, "Europe/Oslo");
  });

  test("a deadline stored as {reason} formats as the intended calendar day")
    .with([
      { reason: "Oslo midnight in summer time", input: "2026-06-30T22:00:00.000Z" },
      { reason: "Oslo midnight in winter time", input: "2026-06-30T23:00:00.000Z" },
      { reason: "UTC midnight", input: "2026-07-01T00:00:00.000Z" },
    ])
    .run(({ assert }, { input }) => {
      assert.equal(DateTime.fromJSDate(new Date(input)).toFormat("dd.MM.yyyy"), "01.07.2026");
    });

  test("a date-only string is read as Norwegian midnight", ({ assert }) => {
    assert.equal(DateTime.fromISO("2026-07-01").toUTC().toISO(), "2026-06-30T22:00:00.000Z");
  });

  test("month names are spelled in Norwegian", ({ assert }) => {
    assert.equal(
      DateTime.fromISO("2026-03-05T12:30:00").toFormat("d. MMMM yyyy 'kl.' HH:mm"),
      "5. mars 2026 kl. 12:30",
    );
  });
});
