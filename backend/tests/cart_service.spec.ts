import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import { CartService } from "#services/cart_service";
import type { BranchItem } from "#shared/branch-item";
import type { Item } from "#shared/item";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { mock } from "#tests/test-doubles";

const BRANCH_ID = "5d765db5fc8c47001c408d81";
const ITEM_ID = "6100000000000000000000a1";

const ITEM = mock<Item>({ id: ITEM_ID, title: "Kjemien stemmer", price: 829 });

test.group("CartService.getOptions", (group) => {
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createItem({ id: ITEM_ID, title: ITEM.title, price: ITEM.price });
  });

  function branchItem(overrides: Partial<BranchItem>) {
    return mock<BranchItem>({
      branch: BRANCH_ID,
      item: ITEM_ID,
      rent: false,
      partlyPayment: false,
      buy: false,
      ...overrides,
    });
  }

  test("rounds the buy price down to the nearest 10 kr", async ({ assert }) => {
    await createBranch({ id: BRANCH_ID, paymentResponsible: false });
    const options = await CartService.getOptions(branchItem({ buy: true }));
    assert.deepEqual(options, [{ type: "buy", price: 820 }]);
  });

  test("buy price is 0 when the branch is responsible for payment", async ({ assert }) => {
    await createBranch({ id: BRANCH_ID, paymentResponsible: true });
    const options = await CartService.getOptions(branchItem({ buy: true }));
    assert.deepEqual(options, [{ type: "buy", price: 0 }]);
  });

  test("rounds the partly-payment prices down to the nearest 10 kr", async ({ assert }) => {
    await createBranch({
      id: BRANCH_ID,
      paymentResponsible: false,
      partlyPaymentPeriods: [
        {
          type: "year",
          date: new Date("2027-07-01"),
          percentageUpFront: 0.5,
          percentageUpFrontUsed: 0.5,
          percentageBuyout: 0.5,
          percentageBuyoutUsed: 0.5,
        },
      ],
    });
    const options = await CartService.getOptions(branchItem({ partlyPayment: true }));
    assert.deepEqual(options, [
      { type: "partly-payment", price: 410, payLater: 410, to: new Date("2027-07-01") },
    ]);
  });
});
