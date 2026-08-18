import { test } from "@japa/runner";
import { expect, use as chaiUse, should } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { createSandbox } from "sinon";

import { OrderItemMovedFromOrderHandler } from "#services/legacy/collections/order/helpers/order-item-moved-from-order-handler/order-item-moved-from-order-handler";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import { Order } from "#shared/order/order";

chaiUse(chaiAsPromised);
should();

test.group("OrderItemMovedFromOrderHandler", (group) => {
  const oiMovedFromOrderHandler = new OrderItemMovedFromOrderHandler();
  let getOrderStub: sinon.SinonStub;
  let updateOrderStub: sinon.SinonStub;

  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => {
    sandbox = createSandbox();
    const orderStub = {
      get: sandbox.stub(),
      update: sandbox.stub(),
    };

    sandbox.stub(StorageService, "Orders").value(orderStub);
    getOrderStub = orderStub.get;
    updateOrderStub = orderStub.update;
    getOrderStub.withArgs(testMovedFromOrderId).resolves(testMovedFromOrder);
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  const testMovedFromOrderId = "testMovedFromOrderId";

  const testMovedFromOrder = {
    amount: 100,
    orderItems: [
      {
        type: "rent",
        item: "item2",
        title: "Signatur 3: Tekstsammling",
        amount: 100,
        unitPrice: 100,
        info: {
          from: new Date(),
          to: new Date(),
          numberOfPeriods: 1,
          periodType: "semester",
        },
      },
    ],
  } as Order;

  const order = {
    id: "testOrder1",
    amount: 0,
    orderItems: [
      {
        type: "rent",
        item: "item2",
        title: "Signatur 3: Tekstsammling",
        amount: 0,
        unitPrice: 0,
        movedFromOrder: testMovedFromOrderId,
        info: {
          from: new Date(),
          to: new Date(),
          numberOfPeriods: 1,
          periodType: "semester",
        },
      },
    ],
    branch: "branch1",
    customer: "customer1",
    byCustomer: false,
  } as Order;

  test('should update the last orderItem with "movedToOrder"', async () => {
    getOrderStub.withArgs(testMovedFromOrderId).resolves(testMovedFromOrder);
    updateOrderStub.resolves(testMovedFromOrder);

    await oiMovedFromOrderHandler.updateOrderItems(order);

    expect(updateOrderStub.callCount).to.equal(1);
  });

  test('should reject if original order item already have "movedToOrder"', async () => {
    // @ts-expect-error fixme: auto ignored
    testMovedFromOrder.orderItems[0]["movedToOrder"] = "anotherOrder";
    getOrderStub.withArgs(testMovedFromOrderId).resolves(testMovedFromOrder);
    updateOrderStub.resolves(testMovedFromOrder);

    return expect(oiMovedFromOrderHandler.updateOrderItems(order)).to.be.rejectedWith(
      BlError,
      /orderItem has "movedToOrder" already set/,
    );
  });

  /** The two GYMNOS editions customers order interchangeably. */
  const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
  const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";

  /** An original order for one item and a new order that moves `movedItemId` out of it. */
  function ordersWithItems(originalItemId: string, movedItemId: string) {
    const originalOrder = {
      id: "originalOrder1",
      amount: 0,
      orderItems: [{ type: "rent", item: originalItemId, amount: 0, unitPrice: 0 }],
    } as Order;
    const newOrder = {
      id: "newOrder1",
      amount: 0,
      orderItems: [
        {
          type: "rent",
          item: movedItemId,
          amount: 0,
          unitPrice: 0,
          movedFromOrder: originalOrder.id,
        },
      ],
    } as Order;
    getOrderStub.withArgs(originalOrder.id).resolves(originalOrder);
    updateOrderStub.resolves(originalOrder);
    return { originalOrder, newOrder };
  }

  /** The orderItems the handler wrote back to the original order. */
  function updatedOrderItems(): { item: string; movedToOrder?: string }[] {
    expect(updateOrderStub.callCount).to.equal(1);
    return updateOrderStub.firstCall.args[1].orderItems;
  }

  test('marks an equivalent edition\'s order item with "movedToOrder"', async () => {
    // The customer ordered GYMNOS 2009 but received a GYMNOS 2012 copy.
    const { originalOrder, newOrder } = ordersWithItems(GYMNOS_2009, GYMNOS_2012);

    await oiMovedFromOrderHandler.updateOrderItems(newOrder);

    expect(updateOrderStub.firstCall.args[0]).to.equal(originalOrder.id);
    expect(updatedOrderItems()).to.deep.equal([
      { type: "rent", item: GYMNOS_2009, amount: 0, unitPrice: 0, movedToOrder: newOrder.id },
    ]);
  });

  test("prefers the exact item over an equivalent edition", async () => {
    const originalOrder = {
      id: "originalOrder1",
      amount: 0,
      orderItems: [
        { type: "rent", item: GYMNOS_2009, amount: 0, unitPrice: 0 },
        { type: "rent", item: GYMNOS_2012, amount: 0, unitPrice: 0 },
      ],
    } as Order;
    const newOrder = {
      id: "newOrder1",
      amount: 0,
      orderItems: [
        {
          type: "rent",
          item: GYMNOS_2012,
          amount: 0,
          unitPrice: 0,
          movedFromOrder: originalOrder.id,
        },
      ],
    } as Order;
    getOrderStub.withArgs(originalOrder.id).resolves(originalOrder);
    updateOrderStub.resolves(originalOrder);

    await oiMovedFromOrderHandler.updateOrderItems(newOrder);

    const [gymnos2009Item, gymnos2012Item] = updatedOrderItems();
    expect(gymnos2009Item?.movedToOrder).to.equal(undefined);
    expect(gymnos2012Item?.movedToOrder).to.equal(newOrder.id);
  });

  test("leaves an unrelated item untouched", async () => {
    const { newOrder } = ordersWithItems("someOtherItem", GYMNOS_2012);

    await oiMovedFromOrderHandler.updateOrderItems(newOrder);

    const [unrelatedItem] = updatedOrderItems();
    expect(unrelatedItem?.movedToOrder).to.equal(undefined);
  });
});
