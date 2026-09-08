import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import BadRequestException from "#exceptions/bad_request_exception";
import Signature from "#models/signature";
import { OrderHistoryService } from "#services/order_history_service";
import { StandCartCheckoutService } from "#services/stand_cart/stand_cart_checkout_service";
import type { StandCartCheckoutRequest } from "#services/stand_cart/stand_cart_checkout_service";
import { StandCartLineResolver } from "#services/stand_cart/stand_cart_line_resolver";
import type {
  StandCartLineContext,
  StandCartResolution,
} from "#services/stand_cart/stand_cart_line_resolver";
import { StandCartPlacement } from "#services/stand_cart/stand_cart_placement";
import { StorageService } from "#services/storage_service";
import { UserService } from "#services/user_service";
import { VippsPaymentService } from "#services/vipps/vipps_payment_service";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Delivery } from "#shared/delivery/delivery";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";
import type { OrderItem } from "#shared/order/order-item/order-item";
import type { StandCartLine, StandCartOption, StandCartSource } from "#shared/stand_cart";
import type { UserDetail } from "#shared/user-detail";
import { asStub, mock, unchecked } from "#tests/test-doubles";

const NOW = new Date("2026-09-07T10:00:00.000Z");
const SEMESTER_END = "2026-12-20T00:00:00.000Z";
const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f01";
const BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f11";
const ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f31";
const NEW_ORDER_ID = "5f7f7f7f7f7f7f7f7f7f7f39";
const CUSTOMER_ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f41";
const DELIVERY_ID = "5f7f7f7f7f7f7f7f7f7f7f51";
const EMPLOYEE = { detailsId: "5f7f7f7f7f7f7f7f7f7f7f7e", permission: "employee" as const };
const BLID = "12345678";

const item = mock<Item>({ id: "item1", title: "Sinus 1T", price: 500 });
const branch = mock<Branch>({
  id: BRANCH_ID,
  name: "Ullern VGS",
  paymentInfo: {
    responsible: true,
    rentPeriods: [
      { type: "semester", date: new Date(SEMESTER_END), maxNumberOfPeriods: 1, percentage: 1 },
    ],
    extendPeriods: [
      { type: "semester", date: new Date(SEMESTER_END), maxNumberOfPeriods: 1, price: 100 },
    ],
  },
});

const orderedItem: OrderItem = {
  type: "rent",
  item: item.id,
  title: item.title,
  amount: 0,
  unitPrice: 0,
  handout: false,
  delivered: false,
  info: { to: new Date(SEMESTER_END), periodType: "semester" },
};
const originalOrder = mock<Order>({
  id: ORDER_ID,
  customer: CUSTOMER_ID,
  branch: BRANCH_ID,
  payments: [],
  orderItems: [orderedItem],
});
const customerItem = mock<CustomerItem>({
  id: CUSTOMER_ITEM_ID,
  item: item.id,
  blid: BLID,
  customer: CUSTOMER_ID,
  type: "rent",
  deadline: new Date(SEMESTER_END),
  handoutInfo: { handoutBy: "branch", handoutById: BRANCH_ID },
});

const ORDER_SOURCE: StandCartSource = { kind: "order", orderId: ORDER_ID, itemId: item.id };

function rentOption(price = 0): StandCartOption {
  return {
    type: "rent",
    to: SEMESTER_END,
    periodType: "semester",
    price,
    available: true,
    monitored: false,
  };
}

function resolution(
  source: StandCartSource,
  options: StandCartOption[],
  line: Partial<StandCartLine> = {},
): StandCartResolution {
  const context: StandCartLineContext =
    source.kind === "order"
      ? { kind: "order", order: originalOrder, orderItem: orderedItem, item }
      : source.kind === "customerItem"
        ? { kind: "customerItem", customerItem, item, handoutBranch: branch }
        : { kind: "item", item };
  return {
    kind: "line",
    line: {
      key: "k",
      source,
      itemId: item.id,
      title: item.title,
      blid: source.kind === "customerItem" ? BLID : null,
      options,
      defaultOptionIndex: 0,
      unavailableReason: null,
      originalBranch: { id: BRANCH_ID, name: "Ullern VGS" },
      notes: [],
      ...line,
    },
    context,
  };
}

/** The default line, priced at 250 kr, for the tests where money changes hands. */
function paidLine(): StandCartCheckoutRequest["lines"][number] {
  return {
    source: ORDER_SOURCE,
    choice: { type: "rent", to: SEMESTER_END },
    blid: BLID,
    expectedPrice: 250,
  };
}

function request(overrides: Partial<StandCartCheckoutRequest> = {}): StandCartCheckoutRequest {
  return {
    customerId: CUSTOMER_ID,
    branchId: BRANCH_ID,
    lines: [
      {
        source: ORDER_SOURCE,
        choice: { type: "rent", to: SEMESTER_END },
        blid: BLID,
        expectedPrice: 0,
      },
    ],
    payment: null,
    delivery: null,
    notifyByEmail: true,
    confirmed: [],
    ...overrides,
  };
}

test.group("StandCartCheckoutService.checkout", (group) => {
  let sandbox: sinon.SinonSandbox;
  let resolve: sinon.SinonStub;
  let ordersAdd: sinon.SinonStub;
  let ordersUpdate: sinon.SinonStub;
  let ordersRemove: sinon.SinonStub;
  let paymentsAdd: sinon.SinonStub;
  let deliveriesAdd: sinon.SinonStub;
  let place: sinon.SinonStub;
  let vipps: {
    create: sinon.SinonStub;
    info: sinon.SinonStub;
    cancel: sinon.SinonStub;
    capture: sinon.SinonStub;
  };

  group.each.setup(() => {
    sandbox = createSandbox();
    resolve = sandbox
      .stub(StandCartLineResolver, "resolveWithContext")
      .resolves(resolution(ORDER_SOURCE, [rentOption()], { blid: BLID }));
    sandbox
      .stub(StorageService.UserDetails, "getOrNull")
      .resolves(
        mock<UserDetail>({ id: CUSTOMER_ID, name: "Ola", tasks: { signAgreement: false } }),
      );
    sandbox.stub(StorageService.Branches, "getOrNull").resolves(branch);
    ordersAdd = sandbox
      .stub(StorageService.Orders, "add")
      .callsFake((order) => Promise.resolve(mock<Order>({ ...order, id: NEW_ORDER_ID })));
    ordersUpdate = sandbox
      .stub(StorageService.Orders, "update")
      .callsFake((id, data) =>
        Promise.resolve(mock<Order>({ ...ordersAdd.firstCall?.returnValue, ...data, id })),
      );
    ordersRemove = sandbox.stub(StorageService.Orders, "remove").resolves();
    paymentsAdd = sandbox
      .stub(StorageService.Payments, "add")
      .resolves(unchecked({ id: "payment1" }));
    sandbox.stub(StorageService.Deliveries, "getOrNull").resolves(null);
    deliveriesAdd = sandbox
      .stub(StorageService.Deliveries, "add")
      .callsFake((delivery) =>
        Promise.resolve(mock<Delivery>({ ...delivery, id: "new-delivery" })),
      );
    place = sandbox
      .stub(StandCartPlacement, "place")
      .callsFake((order) => Promise.resolve({ ...order, placed: true }));
    sandbox.stub(OrderHistoryService, "getOne").resolves(unchecked({ id: NEW_ORDER_ID }));
    sandbox.stub(Signature, "validForCustomer").resolves(unchecked({}));
    sandbox.stub(Signature, "newestForCustomer").resolves(null);
    vipps = {
      create: sandbox.stub().resolves({ reference: NEW_ORDER_ID }),
      info: sandbox.stub().resolves({ state: "CREATED" }),
      cancel: sandbox.stub().resolves({}),
      capture: sandbox.stub().resolves({}),
    };
    sandbox.stub(VippsPaymentService, "payment").value(vipps);
  });
  group.each.teardown(() => sandbox.restore());

  const checkout = (overrides: Partial<StandCartCheckoutRequest> = {}) =>
    StandCartCheckoutService.checkout(request(overrides), EMPLOYEE, NOW);

  test("re-resolves every line with the cart branch and the scanned blid", async ({ assert }) => {
    await checkout();
    assert.deepEqual(resolve.firstCall.args[0], {
      customerId: CUSTOMER_ID,
      branchId: BRANCH_ID,
      source: ORDER_SOURCE,
      blid: BLID,
    });
  });

  test("a free handout is stored as the employee's order on the cart branch and placed at once", async ({
    assert,
  }) => {
    const state = await checkout();
    assert.include(ordersAdd.firstCall.args[0], {
      amount: 0,
      branch: BRANCH_ID,
      customer: CUSTOMER_ID,
      byCustomer: false,
      employee: EMPLOYEE.detailsId,
      placed: false,
      handoutByDelivery: false,
    });
    assert.deepEqual(ordersAdd.firstCall.args[0].notification, { email: true });
    assert.equal(ordersAdd.firstCall.args[0].orderItems[0].blid, BLID);
    assert.isFalse(paymentsAdd.called);
    assert.equal(place.firstCall.args[0].id, NEW_ORDER_ID);
    assert.deepEqual(place.firstCall.args[1], EMPLOYEE);
    assert.equal(state.status, "placed");
    assert.equal(state.orderId, NEW_ORDER_ID);
    assert.isNotNull(state.order);
  });

  test("a cash payment is recorded for the full amount before the order is placed", async ({
    assert,
  }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    const state = await checkout({ payment: { method: "cash" }, lines: [paidLine()] });
    assert.include(paymentsAdd.firstCall.args[0], {
      method: "cash",
      amount: 250,
      order: NEW_ORDER_ID,
      customer: CUSTOMER_ID,
      branch: BRANCH_ID,
      confirmed: false,
    });
    assert.deepEqual(place.firstCall.args[0].payments, ["payment1"]);
    assert.equal(state.status, "paid");
  });

  test("a refund is recorded as a negative Vipps payment, as the legacy stand did", async ({
    assert,
  }) => {
    resolve.resolves(
      resolution(ORDER_SOURCE, [
        { type: "cancel", price: -250, available: true, monitored: false },
      ]),
    );
    const state = await checkout({
      lines: [{ source: ORDER_SOURCE, choice: { type: "cancel" }, expectedPrice: -250 }],
      payment: { method: "vipps" },
    });
    assert.equal(ordersAdd.firstCall.args[0].amount, -250);
    // The same record the legacy stand wrote: the refunded amount, negative, on the method used
    assert.include(paymentsAdd.firstCall.args[0], { method: "vipps", amount: -250 });
    assert.isFalse(vipps.create.called);
    assert.equal(state.status, "paid");
  });

  test("refuses a refund until the employee vouches that it was made in Vipps", async ({
    assert,
  }) => {
    resolve.resolves(
      resolution(ORDER_SOURCE, [
        { type: "cancel", price: -250, available: true, monitored: false },
      ]),
    );
    await assert.rejects(
      () =>
        checkout({
          lines: [{ source: ORDER_SOURCE, choice: { type: "cancel" }, expectedPrice: -250 }],
        }),
      BadRequestException,
      /refusjonen er gjort i Vipps/,
    );
    assert.isFalse(ordersAdd.called);
  });

  test("refuses when something is to be paid and no method was chosen", async ({ assert }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    await assert.rejects(
      () => checkout({ lines: [paidLine()] }),
      BadRequestException,
      /Velg betalingsmåte/,
    );
    assert.isFalse(ordersAdd.called);
  });

  test("refuses a choice the line no longer offers, naming the book", async ({ assert }) => {
    await assert.rejects(
      () =>
        checkout({
          lines: [
            { source: ORDER_SOURCE, choice: { type: "buyout" }, blid: BLID, expectedPrice: 0 },
          ],
        }),
      BadRequestException,
      /«Sinus 1T».*ikke lenger tilgjengelig/,
    );
  });

  test("refuses a blocked option with its reason", async ({ assert }) => {
    resolve.resolves(
      resolution(ORDER_SOURCE, [
        { type: "cancel", price: 0, available: false, monitored: false, reason: "Låst" },
      ]),
    );
    await assert.rejects(
      () =>
        checkout({
          lines: [{ source: ORDER_SOURCE, choice: { type: "cancel" }, expectedPrice: 0 }],
        }),
      BadRequestException,
      /«Sinus 1T»: Låst/,
    );
  });

  test("passes a refused line's message on", async ({ assert }) => {
    resolve.resolves({ kind: "refused", message: "«Sinus 1T» er ikke lenger bestilt" });
    await assert.rejects(() => checkout(), BadRequestException, /ikke lenger bestilt/);
  });

  test("refuses a loan handout without a blid", async ({ assert }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption()]));
    await assert.rejects(
      () =>
        checkout({
          lines: [
            { source: ORDER_SOURCE, choice: { type: "rent", to: SEMESTER_END }, expectedPrice: 0 },
          ],
        }),
      BadRequestException,
      /«Sinus 1T» må skannes/,
    );
  });

  test("refuses the same copy twice", async ({ assert }) => {
    resolve
      .onFirstCall()
      .resolves(resolution(ORDER_SOURCE, [rentOption()], { key: "a", blid: BLID }))
      .onSecondCall()
      .resolves(
        resolution({ kind: "item", itemId: item.id, blid: BLID }, [rentOption()], {
          key: "b",
          blid: BLID,
        }),
      );
    await assert.rejects(
      () =>
        checkout({
          lines: [
            {
              source: ORDER_SOURCE,
              choice: { type: "rent", to: SEMESTER_END },
              blid: BLID,
              expectedPrice: 0,
            },
            {
              source: { kind: "item", itemId: item.id, blid: BLID },
              choice: { type: "rent", to: SEMESTER_END },
              expectedPrice: 0,
            },
          ],
        }),
      BadRequestException,
      /Unik ID 12345678 er lagt til to ganger/,
    );
  });

  test("refuses a price that moved since the cart showed it, so the employee looks again", async ({
    assert,
  }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    await assert.rejects(
      () => checkout({ payment: { method: "cash" } }),
      BadRequestException,
      /«Sinus 1T» har fått ny pris/,
    );
    assert.isFalse(ordersAdd.called);
  });

  test("refuses a blid that is not linked to any book", async ({ assert }) => {
    resolve.resolves({ kind: "unlinked", blid: BLID });
    await assert.rejects(() => checkout(), BadRequestException, /Unik ID 12345678 er ikke koblet/);
  });

  test("a book due from another student needs the employee's say-so", async ({ assert }) => {
    resolve.resolves(
      resolution(ORDER_SOURCE, [rentOption()], {
        blid: BLID,
        notes: [{ kind: "peer-match", deliverFromName: "Kari" }],
      }),
    );
    await assert.rejects(() => checkout(), BadRequestException, /Kari/);
    const state = await checkout({ confirmed: ["peer-match"] });
    assert.equal(state.status, "placed");
  });

  test("a loan to a customer without a valid signature needs the employee's say-so", async ({
    assert,
  }) => {
    asStub(Signature.validForCustomer).resolves(null);
    asStub(StorageService.UserDetails.getOrNull).resolves(
      mock<UserDetail>({ id: CUSTOMER_ID, name: "Ola", tasks: { signAgreement: true } }),
    );
    await assert.rejects(() => checkout(), BadRequestException, /signatur/);
    const state = await checkout({ confirmed: ["missing-signature"] });
    assert.equal(state.status, "placed");
  });

  test("sends the order by mail when the original order had a Bring delivery", async ({
    assert,
  }) => {
    asStub(StorageService.Deliveries.getOrNull).resolves(
      mock<Delivery>({
        id: DELIVERY_ID,
        method: "bring",
        info: {
          from: "0150",
          to: "0151",
          facilityAddress: { address: "Gata 1", postalCode: "0150", postalCity: "Oslo" },
          shipmentAddress: {
            name: "Ola",
            address: "Veien 2",
            postalCode: "0151",
            postalCity: "Oslo",
          },
        },
      }),
    );
    const withDelivery = { ...originalOrder, delivery: DELIVERY_ID };
    resolve.resolves({
      ...resolution(ORDER_SOURCE, [rentOption()], {
        blid: BLID,
        notes: [{ kind: "bring-delivery" }],
      }),
      context: { kind: "order", order: withDelivery, orderItem: orderedItem, item },
    });

    await checkout({ delivery: { trackingNumber: "TR123" } });

    assert.include(deliveriesAdd.firstCall.args[0], {
      method: "bring",
      order: NEW_ORDER_ID,
      amount: 0,
    });
    assert.deepEqual(deliveriesAdd.firstCall.args[0].info, {
      from: "0150",
      to: "0151",
      facilityAddress: { address: "Gata 1", postalCode: "0150", postalCity: "Oslo" },
      shipmentAddress: { name: "Ola", address: "Veien 2", postalCode: "0151", postalCity: "Oslo" },
      trackingNumber: "TR123",
      estimatedDelivery: null,
      amount: 0,
      taxAmount: 0,
    });
    assert.deepEqual(ordersUpdate.firstCall.args, [
      NEW_ORDER_ID,
      { delivery: "new-delivery", handoutByDelivery: true },
    ]);
    assert.equal(place.firstCall.args[0].delivery, "new-delivery");
  });

  test("refuses a tracking number when nothing in the cart goes by mail", async ({ assert }) => {
    await assert.rejects(
      () => checkout({ delivery: { trackingNumber: "TR123" } }),
      BadRequestException,
      /Ingen av bestillingene skal sendes i posten/,
    );
  });

  test("a Vipps payment pushes a request and leaves the order pending", async ({ assert }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    const state = await checkout({
      lines: [paidLine()],
      payment: { method: "vipps", phoneNumber: "+47 912 34 567" },
    });
    assert.include(vipps.create.firstCall.args[0], {
      reference: NEW_ORDER_ID,
      userFlow: "PUSH_MESSAGE",
      customerInteraction: "CUSTOMER_PRESENT",
      paymentDescription: "Boklisten: «Sinus 1T»",
    });
    assert.deepEqual(vipps.create.firstCall.args[0].amount, { currency: "NOK", value: 25_000 });
    assert.deepEqual(vipps.create.firstCall.args[0].customer, { phoneNumber: "4791234567" });
    assert.isFalse(place.called);
    assert.deepEqual(ordersUpdate.firstCall.args, [
      NEW_ORDER_ID,
      { checkoutState: "SessionCreated" },
    ]);
    assert.equal(state.status, "pending");
    assert.equal(state.orderId, NEW_ORDER_ID);
    assert.isNull(state.order);
  });

  test("a number without a Vipps user is reported to the employee and the order is dropped", async ({
    assert,
  }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    vipps.create.rejects(new Error('{"type":"...","extraDetails":[{"name":"7010"}]}'));
    await assert.rejects(
      () =>
        checkout({ lines: [paidLine()], payment: { method: "vipps", phoneNumber: "91234567" } }),
      BadRequestException,
      /ikke registrert i Vipps/,
    );
    assert.deepEqual(ordersRemove.firstCall.args, [NEW_ORDER_ID]);
  });

  test("rejects a bad phone number before any order exists", async ({ assert }) => {
    resolve.resolves(resolution(ORDER_SOURCE, [rentOption(250)], { blid: BLID }));
    await assert.rejects(
      () => checkout({ lines: [paidLine()], payment: { method: "vipps", phoneNumber: "123" } }),
      BadRequestException,
    );
    assert.isFalse(ordersAdd.called);
  });
});

test.group("StandCartCheckoutService.status and cancel", (group) => {
  let sandbox: sinon.SinonSandbox;
  let ordersGet: sinon.SinonStub;
  let ordersUpdate: sinon.SinonStub;
  let paymentsAdd: sinon.SinonStub;
  let place: sinon.SinonStub;
  let vipps: {
    create: sinon.SinonStub;
    info: sinon.SinonStub;
    cancel: sinon.SinonStub;
    capture: sinon.SinonStub;
  };

  const pendingOrder = mock<Order>({
    id: NEW_ORDER_ID,
    amount: 250,
    customer: CUSTOMER_ID,
    branch: BRANCH_ID,
    employee: EMPLOYEE.detailsId,
    placed: false,
    payments: [],
    checkoutState: "SessionCreated",
    orderItems: [orderedItem],
  });

  group.each.setup(() => {
    sandbox = createSandbox();
    ordersGet = sandbox.stub(StorageService.Orders, "get").resolves(pendingOrder);
    ordersUpdate = sandbox
      .stub(StorageService.Orders, "update")
      .callsFake((id, data) => Promise.resolve(mock<Order>({ ...pendingOrder, ...data, id })));
    paymentsAdd = sandbox
      .stub(StorageService.Payments, "add")
      .resolves(unchecked({ id: "payment1" }));
    place = sandbox
      .stub(StandCartPlacement, "place")
      .callsFake((order) => Promise.resolve({ ...order, placed: true }));
    sandbox
      .stub(UserService, "getByUserDetailsId")
      .resolves(unchecked({ userDetail: EMPLOYEE.detailsId, permission: "employee" }));
    sandbox.stub(OrderHistoryService, "getOne").resolves(unchecked({ id: NEW_ORDER_ID }));
    vipps = {
      create: sandbox.stub().resolves({}),
      info: sandbox.stub().resolves({ state: "CREATED" }),
      cancel: sandbox.stub().resolves({}),
      capture: sandbox.stub().resolves({}),
    };
    sandbox.stub(VippsPaymentService, "payment").value(vipps);
  });
  group.each.teardown(() => sandbox.restore());

  test("status reports a placed order as paid without asking Vipps again", async ({ assert }) => {
    ordersGet.resolves({ ...pendingOrder, placed: true });
    const state = await StandCartCheckoutService.status(NEW_ORDER_ID);
    assert.equal(state.status, "paid");
    assert.isFalse(vipps.info.called);
  });

  test("status settles an approved request: payment recorded, order placed by its employee, funds captured", async ({
    assert,
  }) => {
    vipps.info.resolves({ state: "AUTHORIZED" });
    const state = await StandCartCheckoutService.status(NEW_ORDER_ID);
    assert.include(paymentsAdd.firstCall.args[0], { method: "vipps-epayment", amount: 250 });
    assert.deepEqual(place.firstCall.args[1], EMPLOYEE);
    assert.isTrue(vipps.capture.calledWith(NEW_ORDER_ID, 25_000));
    assert.isTrue(ordersUpdate.calledWith(NEW_ORDER_ID, { checkoutState: "PaymentSuccessful" }));
    assert.equal(state.status, "paid");
    assert.isNotNull(state.order);
  });

  test("status keeps waiting while the customer has not answered", async ({ assert }) => {
    const state = await StandCartCheckoutService.status(NEW_ORDER_ID);
    assert.equal(state.status, "pending");
    assert.isFalse(place.called);
  });

  test("status remembers a declined request so the next poll does not ask Vipps", async ({
    assert,
  }) => {
    vipps.info.resolves({ state: "ABORTED" });
    const state = await StandCartCheckoutService.status(NEW_ORDER_ID);
    assert.equal(state.status, "aborted");
    assert.isTrue(ordersUpdate.calledWith(NEW_ORDER_ID, { checkoutState: "PaymentTerminated" }));

    ordersGet.resolves({ ...pendingOrder, checkoutState: "PaymentTerminated" });
    vipps.info.resetHistory();
    const again = await StandCartCheckoutService.status(NEW_ORDER_ID);
    assert.equal(again.status, "aborted");
    assert.isFalse(vipps.info.called);
  });

  test("status refuses an order that never waited for Vipps", async ({ assert }) => {
    ordersGet.resolves({ ...pendingOrder, checkoutState: undefined });
    await assert.rejects(() => StandCartCheckoutService.status(NEW_ORDER_ID), BadRequestException);
  });

  test("cancel withdraws the pending request", async ({ assert }) => {
    const state = await StandCartCheckoutService.cancel(NEW_ORDER_ID);
    assert.isTrue(vipps.cancel.calledWith(NEW_ORDER_ID));
    assert.equal(state.status, "cancelled");
  });

  test("cancel settles the order instead when the customer approved just before", async ({
    assert,
  }) => {
    vipps.cancel.rejects(new Error("already authorized"));
    vipps.info.resolves({ state: "AUTHORIZED" });
    const state = await StandCartCheckoutService.cancel(NEW_ORDER_ID);
    assert.equal(state.status, "paid");
    assert.isTrue(place.calledOnce);
  });
});
