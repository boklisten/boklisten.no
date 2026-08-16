import { test } from "@japa/runner";
import { expect } from "chai";
import sinon, { createSandbox } from "sinon";

import { OrderEmailHandler } from "#services/legacy/order_email_handler";
import { OrderCancellationService } from "#services/order_cancellation_service";
import { StorageService } from "#services/storage_service";

test.group("OrderCancellationService", (group) => {
  let sandbox: sinon.SinonSandbox;
  let addOrderStub: sinon.SinonStub;
  let getOrderStub: sinon.SinonStub;
  let updateOrderStub: sinon.SinonStub;
  let getUserDetailStub: sinon.SinonStub;
  let updateUserDetailStub: sinon.SinonStub;
  let sendOrderReceiptStub: sinon.SinonStub;

  const originalOrder = { id: "order1", branch: "branch1", customer: "customer1" };
  const orderItems = [{ item: "item1", title: "Bok 1" }];

  group.each.setup(() => {
    sandbox = createSandbox();
    const ordersStub = { add: sandbox.stub(), get: sandbox.stub(), update: sandbox.stub() };
    const userDetailsStub = { get: sandbox.stub(), update: sandbox.stub() };
    sandbox.stub(StorageService, "Orders").value(ordersStub);
    sandbox.stub(StorageService, "UserDetails").value(userDetailsStub);
    sendOrderReceiptStub = sandbox.stub(OrderEmailHandler, "sendOrderReceipt").resolves();

    addOrderStub = ordersStub.add;
    getOrderStub = ordersStub.get;
    updateOrderStub = ordersStub.update;
    getUserDetailStub = userDetailsStub.get;
    updateUserDetailStub = userDetailsStub.update;

    addOrderStub.callsFake(async (order) => ({ ...order, id: "cancelOrder1" }));
    getOrderStub
      .withArgs("order1")
      .resolves({ id: "order1", orderItems: [{ item: "item1", title: "Bok 1" }] });
    updateOrderStub.resolves({});
    getUserDetailStub.withArgs("customer1").resolves({ id: "customer1", orders: ["order1"] });
    updateUserDetailStub.resolves({});
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("creates a customer cancellation order and sends the order email", async () => {
    const cancelOrder = await OrderCancellationService.cancelOrderItems({
      originalOrder,
      orderItems,
      notifyCustomer: true,
    });

    expect(cancelOrder.id).to.equal("cancelOrder1");
    expect(addOrderStub.callCount).to.equal(1);
    const added = addOrderStub.firstCall.args[0];
    expect(added.byCustomer).to.equal(true);
    expect(added.employee).to.equal(undefined);
    expect(added.amount).to.equal(0);
    expect(added.placed).to.equal(true);
    expect(added.branch).to.equal("branch1");
    expect(added.customer).to.equal("customer1");
    expect(added.notification).to.deep.equal({ email: true });
    expect(added.orderItems).to.deep.equal([
      {
        movedFromOrder: "order1",
        delivered: true,
        item: "item1",
        title: "Bok 1",
        type: "cancel",
        amount: 0,
        unitPrice: 0,
      },
    ]);
    expect(sendOrderReceiptStub.callCount).to.equal(1);
  });

  test("stamps movedToOrder on the original order items", async () => {
    await OrderCancellationService.cancelOrderItems({
      originalOrder,
      orderItems,
      notifyCustomer: true,
    });

    expect(updateOrderStub.args).to.deep.equal([
      ["order1", { orderItems: [{ item: "item1", title: "Bok 1", movedToOrder: "cancelOrder1" }] }],
    ]);
  });

  test("appends the cancellation order to the customer's userdetail", async () => {
    await OrderCancellationService.cancelOrderItems({
      originalOrder,
      orderItems,
      notifyCustomer: true,
    });

    expect(updateUserDetailStub.args).to.deep.equal([
      ["customer1", { orders: ["order1", "cancelOrder1"] }],
    ]);
  });

  test("marks admin cancellations with the employee and honours notifyCustomer off", async () => {
    await OrderCancellationService.cancelOrderItems({
      originalOrder,
      orderItems,
      employeeDetailsId: "employee1",
      notifyCustomer: false,
    });

    const added = addOrderStub.firstCall.args[0];
    expect(added.byCustomer).to.equal(false);
    expect(added.employee).to.equal("employee1");
    expect(added.notification).to.deep.equal({ email: false });
    expect(sendOrderReceiptStub.callCount).to.equal(0);
    expect(updateUserDetailStub.callCount).to.equal(1);
  });

  test("still cancels when the customer no longer exists", async () => {
    getUserDetailStub.withArgs("customer1").rejects(new Error("not found"));

    const cancelOrder = await OrderCancellationService.cancelOrderItems({
      originalOrder,
      orderItems,
      notifyCustomer: true,
    });

    expect(cancelOrder.id).to.equal("cancelOrder1");
    expect(updateOrderStub.callCount).to.equal(1);
    expect(sendOrderReceiptStub.callCount).to.equal(0);
    expect(updateUserDetailStub.callCount).to.equal(0);
  });
});
