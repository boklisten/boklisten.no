import { test } from "@japa/runner";

import { buildItemUpdate, buildNewItem, currentPriceYear } from "#services/item_management_service";
import type { ItemInput } from "#services/item_management_service";

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
