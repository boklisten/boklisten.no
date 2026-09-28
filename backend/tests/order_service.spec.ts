import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Order from "#models/order";
import { OrderItemService } from "#services/order_item_service";
import { OrderService } from "#services/order_service";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { fixtureId } from "#tests/fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

const CUSTOMER_ID = fixtureId("c91");
const BRANCH_ID = fixtureId("b81");
const ITEM_ID = "6100000000000000000000a1";
const DEADLINE = "2027-07-01";
const TITLE = "Kjemien stemmer";

async function unplacedOrderCount() {
  return (await Order.query().where("placed", false)).length;
}

function rentCartItem() {
  return { id: ITEM_ID, branchId: BRANCH_ID, type: "rent", to: DEADLINE } as const;
}

/** A placed order the customer already has, with one open line for the item. */
function existingOpenOrder(type: "rent" | "buy") {
  return createOrder({
    branchId: BRANCH_ID,
    customerId: CUSTOMER_ID,
    orderItems: [{ type, itemId: ITEM_ID, periodTo: DateTime.fromISO(DEADLINE) }],
  });
}

test.group("OrderService.createFromCart", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(async () => {
    const truncate = await testUtils.db().truncate();
    sandbox = createSandbox();
    await Promise.all([
      createItem({ id: ITEM_ID, title: TITLE, price: 500 }),
      createBranch({ id: BRANCH_ID }),
      createUser({ id: CUSTOMER_ID }),
    ]);
    sandbox.stub(OrderItemService, "createRentOrderItem").resolves({
      type: "rent",
      itemId: ITEM_ID,
      handout: false,
      delivered: false,
      amount: 0,
      unitPrice: 0,
      periodFrom: DateTime.now(),
      periodTo: DateTime.fromISO(DEADLINE),
      numberOfPeriods: 1,
      periodType: "year",
    });
    sandbox.stub(OrderItemService, "createBuyoutOrderItem").resolves({
      type: "buyout",
      itemId: ITEM_ID,
      handout: false,
      delivered: false,
      amount: 250,
      unitPrice: 250,
      customerItemId: "ci1",
    });
    return truncate;
  });
  group.each.teardown(() => sandbox.restore());

  test("creates an order when there are no conflicts", async ({ assert }) => {
    const order = await OrderService.createFromCart(CUSTOMER_ID, [rentCartItem()]);

    const stored = await Order.getOrFail(order.id);
    assert.isFalse(stored.placed);
    assert.isTrue(stored.byCustomer);
    assert.equal(stored.customerId, CUSTOMER_ID);
    assert.equal(stored.branchId, BRANCH_ID);
    assert.deepEqual(
      stored.orderItems.map((orderItem) => [orderItem.type, orderItem.itemId, orderItem.title]),
      [["rent", ITEM_ID, TITLE]],
    );
  });

  test("rejects a cart containing the same item twice", async ({ assert }) => {
    await assert.rejects(
      () => OrderService.createFromCart(CUSTOMER_ID, [rentCartItem(), rentCartItem()]),
      /flere av samme bok/,
    );
    assert.equal(await unplacedOrderCount(), 0);
  });

  test("rejects rent when the customer already has the book", async ({ assert }) => {
    await createCustomerItem({
      id: "ci1",
      itemId: ITEM_ID,
      customerId: CUSTOMER_ID,
      handoutBranchId: BRANCH_ID,
    });
    await assert.rejects(
      () => OrderService.createFromCart(CUSTOMER_ID, [rentCartItem()]),
      /Du har allerede «Kjemien stemmer»/,
    );
    assert.equal(await unplacedOrderCount(), 0);
  });

  test("rejects rent when the customer already has an open order for the book", async ({
    assert,
  }) => {
    await existingOpenOrder("rent");
    await assert.rejects(
      () => OrderService.createFromCart(CUSTOMER_ID, [rentCartItem()]),
      /Du har allerede bestilt «Kjemien stemmer»/,
    );
    assert.equal(await unplacedOrderCount(), 0);
  });

  test("rejects buy when the customer already has an open buy order for the book", async ({
    assert,
  }) => {
    await existingOpenOrder("buy");
    await assert.rejects(
      () =>
        OrderService.createFromCart(CUSTOMER_ID, [
          { id: ITEM_ID, branchId: BRANCH_ID, type: "buy" },
        ]),
      /Du har allerede bestilt «Kjemien stemmer»/,
    );
  });

  test("allows buyout even though the customer has the book", async ({ assert }) => {
    await createCustomerItem({
      id: "ci1",
      itemId: ITEM_ID,
      customerId: CUSTOMER_ID,
      handoutBranchId: BRANCH_ID,
    });
    const order = await OrderService.createFromCart(CUSTOMER_ID, [
      { id: ITEM_ID, branchId: BRANCH_ID, type: "buyout" },
    ]);
    assert.equal(order.orderItems[0]?.customerItemId, "ci1");
  });
});

test.group("OrderService.getOpenOrderItems", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("lists placed lines not yet handed out, delivered or moved on", async ({ assert }) => {
    const [branch, customer, open, handedOut, other] = await Promise.all([
      createBranch(),
      createUser(),
      createItem({ title: "Åpen" }),
      createItem({ title: "Utlevert" }),
      createItem({ title: "Kjøpt" }),
    ]);
    const deadline = DateTime.fromISO("2027-06-30");
    const order = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [
        { itemId: open.id, periodTo: deadline },
        { itemId: handedOut.id, handout: true },
        { itemId: other.id, type: "buy" },
      ],
    });
    await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      placed: false,
      orderItems: [{ itemId: other.id }],
    });

    assert.deepEqual(await OrderService.getOpenOrderItems(customer.id), [
      {
        orderId: order.id,
        itemId: open.id,
        deadline: "2027-06-30",
        cancelable: true,
        title: "Åpen",
      },
    ]);
  });
});
