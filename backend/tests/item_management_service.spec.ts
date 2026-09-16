import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import Item from "#models/item";
import {
  ItemManagementService,
  applyPatch,
  currentPriceYear,
  duplicates,
} from "#services/item_management_service";
import type { ItemInput } from "#services/item_management_service";
import { fixtureId } from "#tests/fixtures";
import { createItem } from "#tests/item_fixtures";

const SINUS: ItemInput = {
  title: "Sinus 1T",
  isbn: 9_788_202_516_260,
  subject: "Matematikk 1T",
  year: 2020,
  price: 935,
  weight: 0.862,
  distributor: "FS",
  discount: 0.15,
  publisher: "cd",
  active: true,
  buyback: false,
};
const OTHER_ISBN = 9_788_202_516_291;

test.group("currentPriceYear", () => {
  test("keys the price history by calendar year", ({ assert }) => {
    assert.equal(currentPriceYear(new Date("2026-09-06T10:00:00Z")), "2026");
    assert.equal(currentPriceYear(new Date("2027-01-01T00:00:00Z")), "2027");
  });
});

test.group("applyPatch", () => {
  test("writes a price change to both the current price and this year's history entry", ({
    assert,
  }) => {
    const item = new Item().merge({ price: 935, priceHistory: { "2025": 900, "2026": 935 } });
    applyPatch(item, { price: 990 }, "2026");
    assert.equal(item.price, 990);
    assert.deepEqual(item.priceHistory, { "2025": 900, "2026": 990 });
  });

  test("touches only the fields that were sent", ({ assert }) => {
    const item = new Item().merge({ title: "Sinus 1T", active: true, buyback: false, price: 935 });
    applyPatch(item, { active: false }, "2026");
    applyPatch(item, { buyback: true, title: "Sinus 1T (2. utg.)" }, "2026");
    applyPatch(item, {}, "2026");
    assert.equal(item.title, "Sinus 1T (2. utg.)");
    assert.isFalse(item.active);
    assert.isTrue(item.buyback);
    assert.equal(item.price, 935);
    assert.isUndefined(item.priceHistory);
  });
});

test.group("duplicates", () => {
  test("lists each value that occurs more than once, once", ({ assert }) => {
    assert.deepEqual(duplicates([1, 2, 1, 1, 3, 3]), [1, 3]);
    assert.deepEqual(duplicates(["a"]), []);
  });
});

test.group("ItemManagementService", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("create starts the price history with this year's price", async ({ assert }) => {
    const created = await ItemManagementService.create(SINUS);

    const stored = await Item.findOrFail(created.id);
    assert.equal(stored.title, "Sinus 1T");
    assert.equal(stored.isbn, SINUS.isbn);
    assert.equal(stored.weight, 0.862);
    assert.deepEqual(stored.priceHistory, { [currentPriceYear()]: 935 });
  });

  test("create refuses an isbn another book already carries", async ({ assert }) => {
    await createItem({ title: "Sinus 1T (gammel)", isbn: SINUS.isbn });
    await assert.rejects(() => ItemManagementService.create(SINUS), /Sinus 1T \(gammel\)/);
  });

  test("update changes the sent fields and keeps the rest", async ({ assert }) => {
    const item = await createItem({ ...SINUS, priceHistory: { "2025": 900 } });

    const updated = await ItemManagementService.update(item.id, { price: 990, weight: null });

    assert.equal(updated.price, 990);
    assert.isNull(updated.weight);
    assert.equal(updated.title, "Sinus 1T");
    assert.deepEqual(updated.priceHistory, { "2025": 900, [currentPriceYear()]: 990 });
  });

  test("update refuses an isbn another book already carries", async ({ assert }) => {
    const item = await createItem({ ...SINUS });
    await createItem({ title: "Sinus R1", isbn: OTHER_ISBN });
    await assert.rejects(
      () => ItemManagementService.update(item.id, { isbn: OTHER_ISBN }),
      /Sinus R1/,
    );
  });
});

test.group("ItemManagementService.bulkUpsert", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("refuses the whole batch when the file repeats an isbn", async ({ assert }) => {
    await assert.rejects(
      () => ItemManagementService.bulkUpsert([SINUS, { ...SINUS, title: "Sinus 1T (kopi)" }]),
      /9788202516260/,
    );
    assert.lengthOf(await Item.all(), 0);
  });

  test("refuses the whole batch when the file repeats an id", async ({ assert }) => {
    const id = fixtureId(1);
    await assert.rejects(
      () =>
        ItemManagementService.bulkUpsert([
          { ...SINUS, id },
          { ...SINUS, id, isbn: OTHER_ISBN },
        ]),
      new RegExp(id),
    );
    assert.lengthOf(await Item.all(), 0);
  });

  test("updates rows whose isbn exists and creates the rest", async ({ assert }) => {
    const existing = await createItem({ title: "Sinus 1T (gammel)", isbn: SINUS.isbn });
    const newBook = { ...SINUS, isbn: OTHER_ISBN, title: "Sinus R1" };

    const summary = await ItemManagementService.bulkUpsert([SINUS, newBook]);

    assert.deepEqual(summary, { createdCount: 1, updatedCount: 1, errors: [] });
    assert.equal((await Item.findOrFail(existing.id)).title, "Sinus 1T");
    assert.equal((await Item.findByIsbn(OTHER_ISBN))?.title, "Sinus R1");
  });

  test("a row with an id updates that book even when its isbn changed", async ({ assert }) => {
    const existing = await createItem({ title: "Sinus 1T", isbn: SINUS.isbn });

    const summary = await ItemManagementService.bulkUpsert([
      { ...SINUS, id: existing.id, isbn: OTHER_ISBN },
    ]);

    assert.deepEqual(summary, { createdCount: 0, updatedCount: 1, errors: [] });
    assert.equal((await Item.findOrFail(existing.id)).isbn, OTHER_ISBN);
    assert.lengthOf(await Item.all(), 1);
  });

  test("a row with an unknown id is reported, not created", async ({ assert }) => {
    const gone = fixtureId("dead");
    const summary = await ItemManagementService.bulkUpsert([{ ...SINUS, id: gone }]);

    assert.equal(summary.createdCount, 0);
    assert.equal(summary.updatedCount, 0);
    assert.deepEqual(summary.errors, [
      { isbn: SINUS.isbn, title: "Sinus 1T", message: `Fant ingen bok med id ${gone}` },
    ]);
    assert.lengthOf(await Item.all(), 0);
  });

  test("a row whose new isbn belongs to another book is reported", async ({ assert }) => {
    const existing = await createItem({ title: "Sinus 1T", isbn: SINUS.isbn });
    await createItem({ title: "Sinus R1", isbn: OTHER_ISBN });

    const summary = await ItemManagementService.bulkUpsert([
      { ...SINUS, id: existing.id, isbn: OTHER_ISBN },
    ]);

    assert.equal(summary.updatedCount, 0);
    assert.match(summary.errors[0]?.message ?? "", /Sinus R1/);
    assert.equal((await Item.findOrFail(existing.id)).isbn, SINUS.isbn);
  });

  test("keeps going after a failing row and reports it", async ({ assert }) => {
    const summary = await ItemManagementService.bulkUpsert([
      // Violates the column constraint, so the insert itself fails.
      { ...SINUS, title: "x".repeat(10), year: Number.NaN },
      { ...SINUS, isbn: OTHER_ISBN, title: "Sinus R1" },
    ]);

    assert.equal(summary.createdCount, 1);
    assert.equal(summary.updatedCount, 0);
    assert.lengthOf(summary.errors, 1);
    assert.equal(summary.errors[0]?.isbn, SINUS.isbn);
  });
});
