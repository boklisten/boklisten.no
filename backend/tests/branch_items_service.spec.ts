import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import BranchItem from "#models/branch_item";
import { BranchItemsService } from "#services/branch_items_service";
import type { BranchItemInput } from "#services/branch_items_service";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";

const BRANCH = "5d765db5fc8c47001c408d81";
const OTHER_BRANCH = "5d765db5fc8c47001c408d82";
const ITEM_KJEMI = "6100000000000000000000a1";
const ITEM_FYSIKK = "6100000000000000000000a2";
const ITEM_HISTORIE = "6100000000000000000000a3";

const ALL_OFF = {
  rent: false,
  rentAtBranch: false,
  partlyPayment: false,
  partlyPaymentAtBranch: false,
  buy: false,
  buyAtBranch: false,
};

function input(itemId: string, overrides: Partial<BranchItemInput> = {}): BranchItemInput {
  return { item: { id: itemId }, ...ALL_OFF, subjects: [], ...overrides };
}

test.group("BranchItemsService", (group) => {
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createBranch({ id: BRANCH });
    await createBranch({ id: OTHER_BRANCH });
    await createItem({ id: ITEM_KJEMI, title: "Kjemien stemmer" });
    await createItem({ id: ITEM_FYSIKK, title: "Fysikkboka" });
    await createItem({ id: ITEM_HISTORIE, title: "Alle tiders historie" });
  });

  test("lists the branch's entries with titles, sorted by title", async ({ assert }) => {
    await BranchItem.createMany([
      { branchId: BRANCH, itemId: ITEM_KJEMI, ...ALL_OFF, rent: true, categories: ["Kjemi 2"] },
      { branchId: BRANCH, itemId: ITEM_HISTORIE, ...ALL_OFF, buyAtBranch: true, categories: [] },
      { branchId: OTHER_BRANCH, itemId: ITEM_FYSIKK, ...ALL_OFF, categories: ["Fysikk 1"] },
    ]);

    const listed = await BranchItemsService.list(BRANCH);

    assert.deepEqual(listed, [
      {
        item: { id: ITEM_HISTORIE, title: "Alle tiders historie" },
        ...ALL_OFF,
        buyAtBranch: true,
        subjects: [],
      },
      {
        item: { id: ITEM_KJEMI, title: "Kjemien stemmer" },
        ...ALL_OFF,
        rent: true,
        subjects: ["Kjemi 2"],
      },
    ]);
  });

  test("replace updates kept entries in place, adds new ones and removes the rest", async ({
    assert,
  }) => {
    const kept = await BranchItem.create({
      branchId: BRANCH,
      itemId: ITEM_KJEMI,
      ...ALL_OFF,
      categories: ["Kjemi 1"],
    });
    await BranchItem.create({ branchId: BRANCH, itemId: ITEM_FYSIKK, ...ALL_OFF, categories: [] });
    const elsewhere = await BranchItem.create({
      branchId: OTHER_BRANCH,
      itemId: ITEM_FYSIKK,
      ...ALL_OFF,
      categories: ["Fysikk 1"],
    });

    await BranchItemsService.replace(BRANCH, [
      input(ITEM_KJEMI, { rent: true, rentAtBranch: true, subjects: [" Kjemi 2 ", "Kjemi 2", ""] }),
      input(ITEM_HISTORIE, { buy: true, subjects: ["Historie"] }),
    ]);

    const rows = await BranchItem.query().where("branchId", BRANCH).orderBy("itemId");
    assert.deepEqual(
      rows.map((row) => ({
        id: row.id,
        itemId: row.itemId,
        rent: row.rent,
        rentAtBranch: row.rentAtBranch,
        buy: row.buy,
        categories: row.categories,
      })),
      [
        {
          id: kept.id,
          itemId: ITEM_KJEMI,
          rent: true,
          rentAtBranch: true,
          buy: false,
          categories: ["Kjemi 2"],
        },
        {
          id: rows[1]?.id ?? "",
          itemId: ITEM_HISTORIE,
          rent: false,
          rentAtBranch: false,
          buy: true,
          categories: ["Historie"],
        },
      ],
    );
    assert.notEqual(rows[1]?.id, kept.id);
    // The other branch's list is untouched.
    assert.isNotNull(await BranchItem.find(elsewhere.id));
  });

  test("replace with an empty list clears the branch", async ({ assert }) => {
    await BranchItem.create({ branchId: BRANCH, itemId: ITEM_KJEMI, ...ALL_OFF, categories: [] });

    await BranchItemsService.replace(BRANCH, []);

    assert.lengthOf(await BranchItem.forBranch(BRANCH), 0);
  });

  test("replace rejects a title listed twice and an unknown title", async ({ assert }) => {
    await assert.rejects(
      () => BranchItemsService.replace(BRANCH, [input(ITEM_KJEMI), input(ITEM_KJEMI)]),
      "Samme bok er oppført flere ganger",
    );
    await assert.rejects(
      () => BranchItemsService.replace(BRANCH, [input("6100000000000000000000ff")]),
      /Fant ikke bok/,
    );
    assert.lengthOf(await BranchItem.forBranch(BRANCH), 0);
  });

  test("findPair returns the branch's entry for a title or null", async ({ assert }) => {
    const row = await BranchItem.create({
      branchId: BRANCH,
      itemId: ITEM_KJEMI,
      ...ALL_OFF,
      categories: [],
    });

    assert.equal((await BranchItem.findPair(BRANCH, ITEM_KJEMI))?.id, row.id);
    assert.isNull(await BranchItem.findPair(OTHER_BRANCH, ITEM_KJEMI));
    assert.isNull(await BranchItem.findPair(BRANCH, ITEM_FYSIKK));
  });
});
