import { test } from "@japa/runner";
import sinon, { createSandbox } from "sinon";

import { CartService } from "#services/cart_service";
import { StorageService } from "#services/storage_service";
import { Branch } from "#shared/branch";
import { BranchItem } from "#shared/branch-item";
import { Item } from "#shared/item";

const BRANCH_ID = "5d765db5fc8c47001c408d81";
const ITEM_ID = "6100000000000000000000a1";

const ITEM = { id: ITEM_ID, title: "Kjemien stemmer", price: 829 } as Item;

test.group("CartService.getOptions", (group) => {
  let sandbox: sinon.SinonSandbox;
  let branchesGet: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.Items, "get").resolves(ITEM);
    branchesGet = sandbox.stub(StorageService.Branches, "get");
  });
  group.each.teardown(() => sandbox.restore());

  function branchItem(overrides: Partial<BranchItem>) {
    return {
      branch: BRANCH_ID,
      item: ITEM_ID,
      rent: false,
      partlyPayment: false,
      buy: false,
      ...overrides,
    } as BranchItem;
  }

  test("rounds the buy price down to the nearest 10 kr", async ({ assert }) => {
    branchesGet.resolves({ id: BRANCH_ID, paymentInfo: { responsible: false } } as Branch);
    const options = await CartService.getOptions(branchItem({ buy: true }));
    assert.deepEqual(options, [{ type: "buy", price: 820 }]);
  });

  test("buy price is 0 when the branch is responsible for payment", async ({ assert }) => {
    branchesGet.resolves({ id: BRANCH_ID, paymentInfo: { responsible: true } } as Branch);
    const options = await CartService.getOptions(branchItem({ buy: true }));
    assert.deepEqual(options, [{ type: "buy", price: 0 }]);
  });

  test("rounds the partly-payment prices down to the nearest 10 kr", async ({ assert }) => {
    branchesGet.resolves({
      id: BRANCH_ID,
      paymentInfo: {
        responsible: false,
        partlyPaymentPeriods: [
          {
            type: "year",
            date: new Date("2027-07-01"),
            percentageUpFront: 0.5,
            percentageBuyout: 0.5,
          },
        ],
      },
    } as Branch);
    const options = await CartService.getOptions(branchItem({ partlyPayment: true }));
    assert.deepEqual(options, [
      { type: "partly-payment", price: 410, payLater: 410, to: new Date("2027-07-01") },
    ]);
  });
});
