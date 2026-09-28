import type { HttpContext } from "@adonisjs/core/http";
import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import CustomerItemsController from "#controllers/customer_items_controller";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { fixtureId } from "#tests/fixtures";
import { createItem } from "#tests/item_fixtures";
import { mock } from "#tests/test-doubles";
import { createUser, userDouble } from "#tests/user_fixtures";

const DETAILS_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const OTHER_ID = "5f7f7f7f7f7f7f7f7f7f7f70";
const ITEM_ID = fixtureId("a1");
const BRANCH_ID = fixtureId("b1");

function contextFor(detailsId: string) {
  return mock<HttpContext>({
    request: { param: () => detailsId },
    auth: { getUserOrFail: () => userDouble({ id: "someone-else", permission: "employee" }) },
  });
}

const book = (overrides: Partial<Parameters<typeof createCustomerItem>[0]> = {}) =>
  createCustomerItem({
    itemId: ITEM_ID,
    customerId: DETAILS_ID,
    handoutBranchId: BRANCH_ID,
    ...overrides,
  });

test.group("CustomerItemsController.forCustomer", (group) => {
  const controller = new CustomerItemsController();

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createItem({ id: ITEM_ID, title: "Mønster 1T" });
    await createBranch({ id: BRANCH_ID, name: "Ullern VGS" });
    await createUser({ id: DETAILS_ID });
    await createUser({ id: OTHER_ID });
  });

  test("returns nothing for an id that is not an object id", async ({ assert }) => {
    assert.deepEqual(await controller.forCustomer(contextFor("not-an-id")), []);
  });

  test("lists only the requested customer's books still out", async ({ assert }) => {
    const held = await book({ blid: "held0001" });
    await book({ customerId: OTHER_ID, blid: "other001" });
    await book({ returned: true });
    await book({ buyout: true });
    await book({ cancel: true });
    await book({ buyback: true });

    const result = await controller.forCustomer(contextFor(DETAILS_ID));

    assert.deepEqual(
      result.map((row) => row.id),
      [held.id],
    );
  });

  test("passes the books through, priced with the customer's own rules", async ({ assert }) => {
    const held = await book({
      blid: "abc123",
      deadline: DateTime.fromISO("2027-09-01"),
    });

    const result = await controller.forCustomer(contextFor(DETAILS_ID));

    assert.lengthOf(result, 1);
    assert.include(result[0], {
      id: held.id,
      item: ITEM_ID,
      title: "Mønster 1T",
      blid: "abc123",
      type: "rent",
    });
    assert.equal(result[0]?.deadline, "2027-09-01");
    assert.deepEqual(result[0]?.handoutBranch, { id: BRANCH_ID, name: "Ullern VGS" });
    assert.deepEqual(
      result[0]?.actions.map((action) => [action.type, action.available]),
      [
        ["extend", false],
        ["buyout", false],
      ],
    );
  });
});
