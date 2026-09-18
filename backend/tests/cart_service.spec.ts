import { test } from "@japa/runner";

import { CartService } from "#services/cart_service";
import type { BranchItem } from "#shared/branch-item";
import type { Item } from "#shared/item";
import { branchDto } from "#tests/branch_fixtures";
import { mock } from "#tests/test-doubles";

const BRANCH_ID = "5d765db5fc8c47001c408d81";
const ITEM_ID = "6100000000000000000000a1";

const ITEM = mock<Item>({ id: ITEM_ID, title: "Kjemien stemmer", price: 829 });

function branchItem(overrides: Partial<BranchItem>) {
  return mock<BranchItem>({
    branchId: BRANCH_ID,
    itemId: ITEM_ID,
    rent: false,
    partlyPayment: false,
    buy: false,
    ...overrides,
  });
}

test.group("CartService.getOptions", () => {
  test("rounds the buy price down to the nearest 10 kr", ({ assert }) => {
    const branch = branchDto({ id: BRANCH_ID, paymentResponsible: false });
    const options = CartService.getOptions(branchItem({ buy: true }), branch, ITEM);
    assert.deepEqual(options, [{ type: "buy", price: 820 }]);
  });

  test("buy price is 0 when the branch is responsible for payment", ({ assert }) => {
    const branch = branchDto({ id: BRANCH_ID, paymentResponsible: true });
    const options = CartService.getOptions(branchItem({ buy: true }), branch, ITEM);
    assert.deepEqual(options, [{ type: "buy", price: 0 }]);
  });

  test("rounds the partly-payment prices down to the nearest 10 kr", ({ assert }) => {
    const branch = branchDto({
      id: BRANCH_ID,
      paymentResponsible: false,
      partlyPaymentPeriods: [
        {
          type: "year",
          date: new Date("2027-07-01"),
          percentageUpFront: 0.5,
          percentageBuyout: 0.5,
        },
      ],
    });
    const options = CartService.getOptions(branchItem({ partlyPayment: true }), branch, ITEM);
    assert.deepEqual(options, [
      { type: "partly-payment", price: 410, payLater: 410, to: new Date("2027-07-01") },
    ]);
  });

  test("a title the branch offers no way to order has no options", ({ assert }) => {
    const branch = branchDto({
      id: BRANCH_ID,
      rentPeriods: [
        { type: "year", date: new Date("2027-07-01"), maxNumberOfPeriods: 1, percentage: 0.5 },
      ],
    });
    assert.deepEqual(CartService.getOptions(branchItem({}), branch, ITEM), []);
  });
});
