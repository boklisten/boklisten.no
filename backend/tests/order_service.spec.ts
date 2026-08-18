import { test } from "@japa/runner";
import sinon, { createSandbox } from "sinon";

import { CustomerItemService } from "#services/customer_item_service";
import { OrderItemService } from "#services/order_item_service";
import { OrderService } from "#services/order_service";
import { StorageService } from "#services/storage_service";
import { CustomerItem } from "#shared/customer-item/customer-item";
import { Item } from "#shared/item";
import { Order } from "#shared/order/order";

const CUSTOMER_ID = "5d765db5fc8c47001c408d91";
const BRANCH_ID = "5d765db5fc8c47001c408d81";
const ITEM_ID = "6100000000000000000000a1";
const DEADLINE = new Date("2027-07-01");

const ITEM = { id: ITEM_ID, title: "Kjemien stemmer", price: 500 } as Item;

test.group("OrderService.createFromCart", (group) => {
  let sandbox: sinon.SinonSandbox;
  let ordersAdd: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService.Items, "get").resolves(ITEM);
    sandbox.stub(CustomerItemService, "getCustomerItemByItemIdOrNull").resolves(undefined);
    sandbox.stub(StorageService.Orders, "aggregate").resolves([]);
    sandbox.stub(OrderItemService, "createRentOrderItem").resolves({
      type: "rent",
      item: ITEM_ID,
      title: ITEM.title,
      delivered: false,
      amount: 0,
      unitPrice: 0,
      info: { from: new Date(), to: DEADLINE, numberOfPeriods: 1, periodType: "year" },
    });
    sandbox.stub(OrderItemService, "createBuyoutOrderItem").resolves({
      type: "buyout",
      item: ITEM_ID,
      title: ITEM.title,
      delivered: false,
      amount: 250,
      unitPrice: 250,
      customerItem: "ci1",
    });
    ordersAdd = sandbox
      .stub(StorageService.Orders, "add")
      .callsFake((order) => Promise.resolve({ ...order, id: "order1" } as Order));
  });
  group.each.teardown(() => sandbox.restore());

  function rentCartItem() {
    return { id: ITEM_ID, branchId: BRANCH_ID, type: "rent", to: DEADLINE } as const;
  }

  test("creates an order when there are no conflicts", async ({ assert }) => {
    const order = await OrderService.createFromCart(CUSTOMER_ID, [rentCartItem()]);
    assert.equal(order.id, "order1");
    assert.isTrue(ordersAdd.calledOnce);
  });

  test("rejects a cart containing the same item twice", async ({ assert }) => {
    await assert.rejects(
      () => OrderService.createFromCart(CUSTOMER_ID, [rentCartItem(), rentCartItem()]),
      /flere av samme bok/,
    );
    assert.isFalse(ordersAdd.called);
  });

  test("rejects rent when the customer already has the book", async ({ assert }) => {
    (CustomerItemService.getCustomerItemByItemIdOrNull as sinon.SinonStub).resolves({
      id: "ci1",
    } as CustomerItem);
    await assert.rejects(
      () => OrderService.createFromCart(CUSTOMER_ID, [rentCartItem()]),
      /Du har allerede «Kjemien stemmer»/,
    );
    assert.isFalse(ordersAdd.called);
  });

  test("rejects rent when the customer already has an open order for the book", async ({
    assert,
  }) => {
    (StorageService.Orders.aggregate as sinon.SinonStub).resolves([
      { orderId: "order0", itemId: ITEM_ID, title: ITEM.title, deadline: DEADLINE },
    ]);
    await assert.rejects(
      () => OrderService.createFromCart(CUSTOMER_ID, [rentCartItem()]),
      /Du har allerede bestilt «Kjemien stemmer»/,
    );
    assert.isFalse(ordersAdd.called);
  });

  test("rejects buy when the customer already has an open buy order for the book", async ({
    assert,
  }) => {
    const aggregate = StorageService.Orders.aggregate as sinon.SinonStub;
    aggregate.resolves([{ orderId: "order0", itemId: ITEM_ID, title: ITEM.title, deadline: null }]);
    await assert.rejects(
      () =>
        OrderService.createFromCart(CUSTOMER_ID, [
          { id: ITEM_ID, branchId: BRANCH_ID, type: "buy" },
        ]),
      /Du har allerede bestilt «Kjemien stemmer»/,
    );
    const [pipeline] = aggregate.firstCall.args;
    assert.deepEqual(pipeline[2]["$match"]["orderItems.type"]["$in"], [
      "rent",
      "partly-payment",
      "buy",
    ]);
  });

  test("allows buyout even though the customer has the book", async ({ assert }) => {
    (CustomerItemService.getCustomerItemByItemIdOrNull as sinon.SinonStub).resolves({
      id: "ci1",
    } as CustomerItem);
    const order = await OrderService.createFromCart(CUSTOMER_ID, [
      { id: ITEM_ID, branchId: BRANCH_ID, type: "buyout" },
    ]);
    assert.equal(order.id, "order1");
  });
});
