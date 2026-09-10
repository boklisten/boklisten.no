import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import {
  ItemManagementService,
  buildItemUpdate,
  buildNewItem,
  currentPriceYear,
  duplicates,
} from "#services/item_management_service";
import type { ItemInput } from "#services/item_management_service";
import { StorageService } from "#services/storage_service";

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

test.group("currentPriceYear", () => {
  test("keys the price history by calendar year", ({ assert }) => {
    assert.equal(currentPriceYear(new Date("2026-09-06T10:00:00Z")), "2026");
    assert.equal(currentPriceYear(new Date("2027-01-01T00:00:00Z")), "2027");
  });
});

test.group("buildItemUpdate", () => {
  test("writes a price change to both the current price and this year's history entry", ({
    assert,
  }) => {
    assert.deepEqual(buildItemUpdate({ price: 990 }, "2026"), {
      price: 990,
      "info.price.2026": 990,
    });
  });

  test("touches only the paths that were sent", ({ assert }) => {
    assert.deepEqual(buildItemUpdate({ active: false }, "2026"), { active: false });
    assert.deepEqual(buildItemUpdate({ buyback: true, title: "Sinus 1T (2. utg.)" }, "2026"), {
      buyback: true,
      title: "Sinus 1T (2. utg.)",
    });
    assert.deepEqual(buildItemUpdate({}, "2026"), {});
  });

  test("maps descriptive fields under info and stores weight as a string", ({ assert }) => {
    assert.deepEqual(
      buildItemUpdate(
        {
          isbn: 9_788_202_516_291,
          subject: "Matematikk R1",
          year: 2021,
          weight: 1.2,
          distributor: "SD",
          discount: 0.2,
          publisher: "gyl",
        },
        "2026",
      ),
      {
        "info.isbn": 9_788_202_516_291,
        "info.subject": "Matematikk R1",
        "info.year": 2021,
        "info.weight": "1.2",
        "info.distributor": "SD",
        "info.discount": 0.2,
        "info.publisher": "gyl",
      },
    );
  });
});

test.group("buildNewItem", () => {
  test("starts the price history with this year's price", ({ assert }) => {
    assert.deepEqual(buildNewItem(SINUS, "2026"), {
      title: "Sinus 1T",
      price: 935,
      active: true,
      buyback: false,
      info: {
        isbn: 9_788_202_516_260,
        subject: "Matematikk 1T",
        year: 2020,
        price: { "2026": 935 },
        weight: "0.862",
        distributor: "FS",
        discount: 0.15,
        publisher: "cd",
      },
    });
  });
});

test.group("duplicates", () => {
  test("lists each value that occurs more than once, once", ({ assert }) => {
    assert.deepEqual(duplicates([1, 2, 1, 1, 3, 3]), [1, 3]);
    assert.deepEqual(duplicates(["a"]), []);
  });
});

test.group("ItemManagementService.bulkUpsert", (group) => {
  let sandbox: sinon.SinonSandbox;
  let itemsStub: {
    getByQueryOrNull: sinon.SinonStub;
    getOrNull: sinon.SinonStub;
    add: sinon.SinonStub;
    update: sinon.SinonStub;
  };

  group.each.setup(() => {
    sandbox = createSandbox();
    itemsStub = {
      getByQueryOrNull: sandbox.stub().resolves(null),
      getOrNull: sandbox.stub().resolves(null),
      add: sandbox.stub().callsFake(async (item) => ({ id: "new", ...item })),
      update: sandbox.stub().callsFake(async (id, patch) => ({ id, ...patch })),
    };
    sandbox.stub(StorageService, "Items").value(itemsStub);
  });

  group.each.teardown(() => {
    sandbox.restore();
  });

  test("refuses the whole batch when the file repeats an isbn", async ({ assert }) => {
    await assert.rejects(
      () => ItemManagementService.bulkUpsert([SINUS, { ...SINUS, title: "Sinus 1T (kopi)" }]),
      /9788202516260/,
    );
    assert.isFalse(itemsStub.add.called);
    assert.isFalse(itemsStub.update.called);
  });

  test("refuses the whole batch when the file repeats an id", async ({ assert }) => {
    await assert.rejects(
      () =>
        ItemManagementService.bulkUpsert([
          { ...SINUS, id: "sinus-id" },
          { ...SINUS, id: "sinus-id", isbn: 9_788_202_516_291 },
        ]),
      /sinus-id/,
    );
    assert.isFalse(itemsStub.add.called);
    assert.isFalse(itemsStub.update.called);
  });

  test("updates rows whose isbn exists and creates the rest", async ({ assert }) => {
    const existing = { id: "sinus-id", title: "Sinus 1T (gammel)", info: { isbn: SINUS.isbn } };
    itemsStub.getByQueryOrNull.callsFake(async (query) =>
      query.stringFilters[0].value === String(SINUS.isbn) ? [existing] : null,
    );
    const newBook = { ...SINUS, isbn: 9_788_202_516_291, title: "Sinus R1" };

    const summary = await ItemManagementService.bulkUpsert([SINUS, newBook]);

    assert.deepEqual(summary, { createdCount: 1, updatedCount: 1, errors: [] });
    assert.equal(itemsStub.update.firstCall.args[0], "sinus-id");
    assert.equal(itemsStub.update.firstCall.args[1].title, "Sinus 1T");
    assert.equal(itemsStub.add.firstCall.args[0].title, "Sinus R1");
  });

  test("a row with an id updates that book even when its isbn changed", async ({ assert }) => {
    const existing = { id: "sinus-id", title: "Sinus 1T", info: { isbn: SINUS.isbn } };
    itemsStub.getOrNull.callsFake(async (id) => (id === "sinus-id" ? existing : null));
    const newIsbn = 9_788_202_516_291;

    const summary = await ItemManagementService.bulkUpsert([
      { ...SINUS, id: "sinus-id", isbn: newIsbn },
    ]);

    assert.deepEqual(summary, { createdCount: 0, updatedCount: 1, errors: [] });
    assert.equal(itemsStub.update.firstCall.args[0], "sinus-id");
    assert.equal(itemsStub.update.firstCall.args[1]["info.isbn"], newIsbn);
    assert.isFalse(itemsStub.add.called);
  });

  test("a row with an unknown id is reported, not created", async ({ assert }) => {
    const summary = await ItemManagementService.bulkUpsert([{ ...SINUS, id: "gone" }]);

    assert.equal(summary.createdCount, 0);
    assert.equal(summary.updatedCount, 0);
    assert.deepEqual(summary.errors, [
      { isbn: SINUS.isbn, title: "Sinus 1T", message: "Fant ingen bok med id gone" },
    ]);
    assert.isFalse(itemsStub.add.called);
  });

  test("a row whose new isbn belongs to another book is reported", async ({ assert }) => {
    const existing = { id: "sinus-id", title: "Sinus 1T", info: { isbn: SINUS.isbn } };
    const other = { id: "other-id", title: "Sinus R1", info: { isbn: 9_788_202_516_291 } };
    itemsStub.getOrNull.resolves(existing);
    itemsStub.getByQueryOrNull.resolves([other]);

    const summary = await ItemManagementService.bulkUpsert([
      { ...SINUS, id: "sinus-id", isbn: other.info.isbn },
    ]);

    assert.equal(summary.updatedCount, 0);
    assert.match(summary.errors[0]?.message ?? "", /Sinus R1/);
    assert.isFalse(itemsStub.update.called);
  });

  test("keeps going after a failing row and reports it", async ({ assert }) => {
    itemsStub.add.onFirstCall().rejects(new Error("boom")).onSecondCall().resolves({ id: "ok" });

    const summary = await ItemManagementService.bulkUpsert([
      SINUS,
      { ...SINUS, isbn: 9_788_202_516_291, title: "Sinus R1" },
    ]);

    assert.equal(summary.createdCount, 1);
    assert.equal(summary.updatedCount, 0);
    assert.deepEqual(summary.errors, [{ isbn: SINUS.isbn, title: "Sinus 1T", message: "boom" }]);
  });
});
