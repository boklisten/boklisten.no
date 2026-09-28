import * as Sentry from "@sentry/node";
import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import CustomerItem from "#models/customer_item";
import Order from "#models/order";
import Signature from "#models/signature";
import User from "#models/user";
import { EmployeeMonitoringService } from "#services/employee_monitoring_service";
import { MatchRepository } from "#services/matches/match_repository";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { StandCartPlacement } from "#services/stand_cart/stand_cart_placement";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createPayment } from "#tests/payment_fixtures";
import { createUniqueItem } from "#tests/unique_item_fixtures";
import { asStub, unchecked } from "#tests/test-doubles";
import { createUser, userDouble } from "#tests/user_fixtures";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f01";
const BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f11";
const ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f31";
const EMPLOYEE = { userId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const SEMESTER_END = "2026-12-20";

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

type OrderLine = NonNullable<Parameters<typeof createOrder>[0]["orderItems"]>[number];

/** A stand order as checkout stores it, not yet placed. */
async function orderWith(orderItems: Partial<OrderLine>[], amount = 0): Promise<Order> {
  return createOrder({
    id: ORDER_ID,
    customerId: CUSTOMER_ID,
    branchId: BRANCH_ID,
    employeeId: EMPLOYEE.userId,
    placed: false,
    byCustomer: false,
    amount,
    orderItems: orderItems.map((orderItem) => ({
      type: "rent",
      itemId: "item1",
      blid: "12345678",
      ...orderItem,
    })),
  });
}

async function handoutOrder(): Promise<Order> {
  return orderWith([
    {
      handout: true,
      periodTo: DateTime.fromISO(SEMESTER_END),
      periodType: "semester",
    },
    { type: "buy", handout: true, blid: "87654321", itemId: "item2" },
  ]);
}

test.group("StandCartPlacement.place", (group) => {
  let sandbox: sinon.SinonSandbox;
  let placeOrder: sinon.SinonStub;
  let recordHandover: sinon.SinonStub;
  let report: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createBranch({ id: BRANCH_ID });
    await createUser({ id: CUSTOMER_ID });
    await createUser({ id: EMPLOYEE.userId });
    await createItem({ id: "item1", title: "Sinus 1T" });
    await createItem({ id: "item2", title: "Kosmos SF" });
    // The stand hands out only registered stickers.
    await createUniqueItem({ blid: "12345678", itemId: "item1" });
    await createUniqueItem({ blid: "87654321", itemId: "item2" });
    sandbox = createSandbox();
    sandbox.stub(User, "findOrFail").resolves(userDouble({ id: CUSTOMER_ID, name: "Ola" }));
    placeOrder = sandbox
      .stub(OrderPlacedHandler.prototype, "placeOrder")
      .callsFake(async (order: Order) => {
        order.placed = true;
        return order.save();
      });
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
    const placed = await StandCartPlacement.place(await handoutOrder(), EMPLOYEE);

    const created = await CustomerItem.all();
    assert.lengthOf(created, 1);
    const [customerItem] = created;
    assert.deepEqual(
      customerItem && {
        itemId: customerItem.itemId,
        blid: customerItem.blid,
        customerId: customerItem.customerId,
        type: customerItem.type,
        handoutBranchId: customerItem.handoutBranchId,
        handoutEmployeeId: customerItem.handoutEmployeeId,
      },
      {
        itemId: "item1",
        blid: "12345678",
        customerId: CUSTOMER_ID,
        type: "rent",
        handoutBranchId: BRANCH_ID,
        handoutEmployeeId: EMPLOYEE.userId,
      },
    );
    assert.equal(created[0]?.deadline.toISODate(), SEMESTER_END);
    const stored = await Order.findOrFail(ORDER_ID);
    assert.equal(stored.orderItems[0]?.customerItemId, created[0]?.id);
    assert.isNull(stored.orderItems[1]?.customerItemId);
    assert.equal(placeOrder.firstCall.args[0].orderItems[0].customerItemId, created[0]?.id);
    // The employee, not the customer: the handler names them on returned books
    assert.equal(placeOrder.firstCall.args[1], EMPLOYEE.userId);
    assert.isTrue(placed.placed);
  });

  test("an order item that hands nothing out creates no customer item", async ({ assert }) => {
    await StandCartPlacement.place(
      await orderWith([{ type: "cancel", handout: false, delivered: true }]),
      EMPLOYEE,
    );
    assert.lengthOf(await CustomerItem.all(), 0);
  });

  test("records a handover from the stand for each copy handed out", async ({ assert }) => {
    await StandCartPlacement.place(await handoutOrder(), EMPLOYEE);
    assert.equal(recordHandover.callCount, 2);
    assert.include(recordHandover.firstCall.args[0], {
      blid: "12345678",
      itemId: "item1",
      fromUserId: null,
      toUserId: CUSTOMER_ID,
      orderId: ORDER_ID,
    });
  });

  test("records a handover to the stand for each copy taken back", async ({ assert }) => {
    const heldBook = await createCustomerItem({
      itemId: "item1",
      blid: "12345678",
      customerId: CUSTOMER_ID,
      deadline: DateTime.fromISO(SEMESTER_END),
      handoutBranchId: BRANCH_ID,
    });
    await StandCartPlacement.place(
      await orderWith([{ type: "return", customerItemId: heldBook.id }]),
      EMPLOYEE,
    );
    assert.equal(recordHandover.callCount, 1);
    assert.include(recordHandover.firstCall.args[0], {
      blid: "12345678",
      fromUserId: CUSTOMER_ID,
      toUserId: null,
    });
  });

  test("tells the administrator about a loan handed out without a valid signature", async ({
    assert,
  }) => {
    asStub(Signature.validForCustomer).resolves(null);
    // The signing task is already on the customer, so no reconciliation queries are needed
    asStub(User.findOrFail).resolves(
      userDouble({ id: CUSTOMER_ID, name: "Ola", taskSignAgreement: true }),
    );
    await StandCartPlacement.place(await handoutOrder(), EMPLOYEE);
    assert.isTrue(report.calledOnce);
    assert.include(report.firstCall.args[0], {
      action: "handout-without-signature",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
    });
  });

  test("tells the administrator about cash taken at the stand", async ({ assert }) => {
    const paidInCash = await orderWith(
      [{ type: "buy", handout: true, amount: 250, unitPrice: 250 }],
      250,
    );
    await createPayment({ orderId: paidInCash.id, method: "cash", amount: 250 });
    await StandCartPlacement.place(paidInCash, EMPLOYEE);
    assert.isTrue(report.calledOnce);
    assert.include(report.firstCall.args[0], {
      action: "cash-payment-received",
      employee: EMPLOYEE,
      customerId: CUSTOMER_ID,
    });
  });

  test("a handover that cannot be recorded never undoes the placement", async ({ assert }) => {
    recordHandover.rejects(new Error("postgres down"));
    const captured = recordEventsSentToSentry();
    const placed = await StandCartPlacement.place(await handoutOrder(), EMPLOYEE);
    await Sentry.flush(2000);
    await Sentry.close();
    assert.isTrue(placed.placed);
    assert.deepEqual(captured, ["postgres down"]);
  });
});
