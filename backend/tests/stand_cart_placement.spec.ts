import * as Sentry from "@sentry/node";
import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Signature from "#models/signature";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import { MatchRepository } from "#services/matches/match_repository";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { StandCartPlacement } from "#services/stand_cart/stand_cart_placement";
import { StorageService } from "#services/storage_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { UserDetail } from "#shared/user-detail";
import { asStub, mock, unchecked } from "#tests/test-doubles";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f01";
const BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f11";
const ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f31";
const EMPLOYEE = { detailsId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const SEMESTER_END = new Date("2026-12-20T00:00:00.000Z");

/**
 * Sentry is never initialised under API_ENV=test, so stand up a throwaway client whose beforeSend
 * records what was forwarded and then drops it.
 */
function recordEventsSentToSentry(): string[] {
  const captured: string[] = [];
  Sentry.init({
    dsn: "https://public@o0.ingest.sentry.io/0",
    enabled: true,
    defaultIntegrations: false,
    beforeSend(event) {
      captured.push(event.exception?.values?.[0]?.value ?? "");
      return null;
    },
  });
  return captured;
}

function orderWith(orderItems: Partial<OrderItem>[]): Order {
  return mock<Order>({
    id: ORDER_ID,
    customer: CUSTOMER_ID,
    branch: BRANCH_ID,
    employee: EMPLOYEE.detailsId,
    placed: false,
    byCustomer: false,
    payments: [],
    amount: 0,
    handoutByDelivery: false,
    orderItems: orderItems.map((orderItem) => ({
      type: "rent",
      item: "item1",
      title: "Sinus 1T",
      blid: "12345678",
      amount: 0,
      unitPrice: 0,
      handout: false,
      delivered: false,
      ...orderItem,
    })),
  });
}

const handoutOrder = orderWith([
  { handout: true, info: { to: SEMESTER_END, periodType: "semester" } },
  { type: "buy", handout: true, blid: "87654321", item: "item2", title: "Kosmos SF" },
]);

test.group("StandCartPlacement.place", (group) => {
  let sandbox: sinon.SinonSandbox;
  let customerItemsAdd: sinon.SinonStub;
  let ordersUpdate: sinon.SinonStub;
  let placeOrder: sinon.SinonStub;
  let recordHandover: sinon.SinonStub;
  let report: sinon.SinonStub;
  let userDetailsUpdate: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    customerItemsAdd = sandbox
      .stub(StorageService.CustomerItems, "add")
      .callsFake((customerItem) => Promise.resolve({ ...customerItem, id: "new-ci" }));
    sandbox.stub(StorageService.CustomerItems, "getMany").resolves([]);
    sandbox.stub(StorageService.CustomerItems, "getOrNull").resolves(null);
    ordersUpdate = sandbox
      .stub(StorageService.Orders, "update")
      .callsFake((id, data) => Promise.resolve({ ...handoutOrder, ...data, id }));
    sandbox
      .stub(StorageService.UserDetails, "get")
      .resolves(mock<UserDetail>({ id: CUSTOMER_ID, name: "Ola", customerItems: ["old-ci"] }));
    userDetailsUpdate = sandbox.stub(StorageService.UserDetails, "update").resolves();
    placeOrder = sandbox
      .stub(OrderPlacedHandler.prototype, "placeOrder")
      .callsFake((order) => Promise.resolve({ ...order, placed: true }));
    sandbox.stub(MatchRepository, "findReceiverObligation").resolves(null);
    sandbox.stub(MatchRepository, "findSenderObligation").resolves(null);
    recordHandover = sandbox.stub(MatchRepository, "recordHandover").resolves(unchecked({}));
    report = sandbox.stub(EmployeeMonitoringService, "report").resolves();
    sandbox.stub(Signature, "validForCustomer").resolves(unchecked({}));
    sandbox.stub(Signature, "newestForCustomer").resolves(null);
  });
  group.each.teardown(() => sandbox.restore());

  test("creates a customer item for each loan handed out and writes its id onto the order before placing", async ({
    assert,
  }) => {
    const placed = await StandCartPlacement.place(handoutOrder, EMPLOYEE);

    assert.isTrue(customerItemsAdd.calledOnce);
    assert.include(customerItemsAdd.firstCall.args[0], {
      item: "item1",
      blid: "12345678",
      customer: CUSTOMER_ID,
      type: "rent",
      handout: true,
    });
    const [updatedId, update] = ordersUpdate.firstCall.args;
    assert.equal(updatedId, ORDER_ID);
    assert.equal(update.orderItems[0].customerItem, "new-ci");
    assert.isUndefined(update.orderItems[1].customerItem);
    assert.equal(placeOrder.firstCall.args[0].orderItems[0].customerItem, "new-ci");
    // The employee, not the customer: the handler names them on returned books
    assert.equal(placeOrder.firstCall.args[1], EMPLOYEE.detailsId);
    assert.isTrue(placed.placed);
    // The new copy is listed on the customer next to the ones they already had
    assert.deepEqual(userDetailsUpdate.firstCall.args, [
      CUSTOMER_ID,
      { customerItems: ["old-ci", "new-ci"] },
    ]);
  });

  test("an order item that hands nothing out creates no customer item", async ({ assert }) => {
    await StandCartPlacement.place(
      orderWith([{ type: "cancel", handout: false, delivered: true }]),
      EMPLOYEE,
    );
    assert.isFalse(customerItemsAdd.called);
    assert.isFalse(userDetailsUpdate.called);
  });

  test("records a handover from the stand for each copy handed out", async ({ assert }) => {
    await StandCartPlacement.place(handoutOrder, EMPLOYEE);
    assert.equal(recordHandover.callCount, 2);
    assert.include(recordHandover.firstCall.args[0], {
      blid: "12345678",
      itemId: "item1",
      fromUserDetailId: null,
      toUserDetailId: CUSTOMER_ID,
      orderId: ORDER_ID,
    });
  });

  test("records a handover to the stand for each copy taken back", async ({ assert }) => {
    const heldBook = mock<CustomerItem>({
      id: "ci1",
      item: "item1",
      blid: "12345678",
      customer: CUSTOMER_ID,
      deadline: SEMESTER_END,
      handoutInfo: { handoutBy: "branch", handoutById: BRANCH_ID },
    });
    asStub(StorageService.CustomerItems.getMany).resolves([heldBook]);
    await StandCartPlacement.place(orderWith([{ type: "return", customerItem: "ci1" }]), EMPLOYEE);
    assert.equal(recordHandover.callCount, 1);
    assert.include(recordHandover.firstCall.args[0], {
      blid: "12345678",
      fromUserDetailId: CUSTOMER_ID,
      toUserDetailId: null,
    });
  });

  test("tells the administrator about a loan handed out without a valid signature", async ({
    assert,
  }) => {
    asStub(Signature.validForCustomer).resolves(null);
    // The signing task is already on the customer, so no reconciliation queries are needed
    asStub(StorageService.UserDetails.get).resolves(
      mock<UserDetail>({ id: CUSTOMER_ID, customerItems: [], tasks: { signAgreement: true } }),
    );
    await StandCartPlacement.place(handoutOrder, EMPLOYEE);
    assert.isTrue(report.calledOnce);
    assert.include(report.firstCall.args[0], {
      action: "handout-without-signature",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
    });
  });

  test("a handover that cannot be recorded never undoes the placement", async ({ assert }) => {
    recordHandover.rejects(new Error("postgres down"));
    const captured = recordEventsSentToSentry();
    const placed = await StandCartPlacement.place(handoutOrder, EMPLOYEE);
    await Sentry.flush(2000);
    await Sentry.close();
    assert.isTrue(placed.placed);
    assert.deepEqual(captured, ["postgres down"]);
  });
});
