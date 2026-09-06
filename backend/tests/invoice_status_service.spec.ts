import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import {
  invoicePaidLineAmount,
  setInvoiceLineCancelled,
  setInvoiceStatus,
} from "#services/invoices/invoice_status_service";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { StorageService } from "#services/storage_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { Invoice } from "#shared/invoice";
import type { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";
import { mock } from "#tests/test-doubles";

const CUSTOMER_ID = "6100000000000000000000c1";
const EMPLOYEE_ID = "6100000000000000000000e1";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return mock<Invoice>({
    id: "inv1",
    invoiceId: "20263071",
    branch: "branch1",
    customerHavePayed: false,
    toCreditNote: false,
    toDebtCollection: false,
    toLossNote: false,
    customerInfo: { userDetail: CUSTOMER_ID, name: "Elise Nordmann" },
    customerItemPayments: [
      {
        customerItem: "ci1",
        item: "i1",
        title: "Psykologi 2 2022",
        numberOfItems: 1,
        payment: { unit: 1049, gross: 1154, net: 1154, vat: 0, discount: 0 },
      },
      {
        customerItem: "ci2",
        item: "i2",
        title: "Matematikk R1",
        numberOfItems: 1,
        payment: { unit: 899, gross: 989, net: 989, vat: 0, discount: 0 },
      },
    ],
    ...overrides,
  });
}

function customerItem(overrides: Partial<CustomerItem>): CustomerItem {
  return mock<CustomerItem>({
    customer: CUSTOMER_ID,
    returned: false,
    buyout: false,
    handoutInfo: { handoutBy: "branch", handoutById: "branch1", time: new Date() },
    ...overrides,
  });
}

test.group("invoice status changes", (group) => {
  let sandbox: sinon.SinonSandbox;
  let getInvoice: sinon.SinonStub;
  let updateInvoice: sinon.SinonStub;
  let customerItems: { getMany: sinon.SinonStub; update: sinon.SinonStub };
  let orders: { add: sinon.SinonStub; remove: sinon.SinonStub; getByQueryOrNull: sinon.SinonStub };
  let userDetails: { getOrNull: sinon.SinonStub; update: sinon.SinonStub };
  let placeOrder: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    getInvoice = sandbox.stub().resolves(invoice());
    updateInvoice = sandbox
      .stub()
      .callsFake((_id: string, patch: Partial<Invoice>) => Promise.resolve(invoice(patch)));
    sandbox.stub(StorageService, "Invoices").value({ get: getInvoice, update: updateInvoice });
    customerItems = {
      getMany: sandbox
        .stub()
        .resolves([
          customerItem({ id: "ci1", item: "i1", blid: "blid1" }),
          customerItem({ id: "ci2", item: "i2", blid: "blid2", returned: true }),
        ]),
      update: sandbox.stub().resolves({}),
    };
    sandbox.stub(StorageService, "CustomerItems").value(customerItems);
    orders = {
      add: sandbox.stub().callsFake((order: Order) => Promise.resolve({ ...order, id: "order1" })),
      remove: sandbox.stub().resolves({}),
      getByQueryOrNull: sandbox.stub().resolves([]),
    };
    sandbox.stub(StorageService, "Orders").value(orders);
    userDetails = {
      getOrNull: sandbox
        .stub()
        .resolves(mock<UserDetail>({ id: CUSTOMER_ID, orders: ["order1", "other"] })),
      update: sandbox.stub().resolves({}),
    };
    sandbox.stub(StorageService, "UserDetails").value(userDetails);
    placeOrder = sandbox.stub(OrderPlacedHandler.prototype, "placeOrder").resolves(mock<Order>());
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("order line amounts are whole kroner truncated to tens, as bl-admin's price service did", ({
    assert,
  }) => {
    assert.equal(invoicePaidLineAmount(1154), 1150);
    assert.equal(invoicePaidLineAmount(989), 980);
    assert.equal(invoicePaidLineAmount(310), 310);
    assert.equal(invoicePaidLineAmount(1153.9), 1150);
  });

  test("marking paid writes the flags, records an invoice-paid order for the unreturned books and sets buyout on all", async ({
    assert,
  }) => {
    const { warnings } = await setInvoiceStatus("inv1", "paid", EMPLOYEE_ID);

    assert.deepEqual(updateInvoice.firstCall.args[1], {
      customerHavePayed: true,
      toCreditNote: false,
      toDebtCollection: false,
      toLossNote: false,
    });
    const [order] = orders.add.firstCall.args;
    assert.deepEqual(order, {
      amount: 1150,
      orderItems: [
        {
          type: "invoice-paid",
          item: "i1",
          title: "Psykologi 2 2022",
          blid: "blid1",
          amount: 1150,
          unitPrice: 1150,
          handout: true,
          info: { customerItem: "ci1" },
          delivered: true,
          customerItem: "ci1",
        },
      ],
      branch: "branch1",
      customer: CUSTOMER_ID,
      byCustomer: false,
      employee: EMPLOYEE_ID,
      placed: false,
      payments: [],
      handoutByDelivery: false,
      notification: { email: false },
    });
    assert.equal(placeOrder.firstCall.args[0].id, "order1");
    assert.deepEqual(
      customerItems.update.args.map(([id, patch]) => [id, patch]),
      [
        ["ci1", { buyout: true }],
        ["ci2", { buyout: true }],
      ],
    );
    assert.deepEqual(warnings, []);
  });

  test("marking paid when no book is active still sets the flags, with a warning", async ({
    assert,
  }) => {
    customerItems.getMany.resolves([customerItem({ id: "ci1", item: "i1", returned: true })]);

    const { warnings } = await setInvoiceStatus("inv1", "paid", EMPLOYEE_ID);

    assert.isTrue(orders.add.notCalled);
    assert.lengthOf(warnings, 1);
    assert.equal(updateInvoice.callCount, 1);
  });

  test("leaving paid removes the invoice-paid order from the customer and clears buyout", async ({
    assert,
  }) => {
    getInvoice.resolves(invoice({ customerHavePayed: true }));
    orders.getByQueryOrNull.resolves([
      mock<Order>({ id: "unrelated", orderItems: [{ type: "rent", item: "i1" }] }),
      mock<Order>({
        id: "order1",
        orderItems: [
          { type: "invoice-paid", item: "i1" },
          { type: "invoice-paid", item: "i2" },
        ],
      }),
    ]);

    const { warnings } = await setInvoiceStatus("inv1", "creditNote", EMPLOYEE_ID);

    assert.deepEqual(updateInvoice.firstCall.args[1], {
      customerHavePayed: false,
      toCreditNote: true,
      toDebtCollection: false,
      toLossNote: false,
    });
    assert.deepEqual(orders.remove.firstCall.args, ["order1"]);
    assert.deepEqual(userDetails.update.firstCall.args, [CUSTOMER_ID, { orders: ["other"] }]);
    assert.deepEqual(
      customerItems.update.args.map(([id, patch]) => [id, patch]),
      [
        ["ci1", { buyout: false }],
        ["ci2", { buyout: false }],
      ],
    );
    assert.deepEqual(warnings, []);
  });

  test("leaving paid without a matching order warns instead of failing", async ({ assert }) => {
    getInvoice.resolves(invoice({ customerHavePayed: true }));

    const { warnings } = await setInvoiceStatus("inv1", "unpaid", EMPLOYEE_ID);

    assert.isTrue(orders.remove.notCalled);
    assert.lengthOf(warnings, 1);
  });

  test("changing between the other statuses touches nothing but the flags", async ({ assert }) => {
    await setInvoiceStatus("inv1", "debtCollection", EMPLOYEE_ID);

    assert.isTrue(orders.add.notCalled);
    assert.isTrue(orders.remove.notCalled);
    assert.isTrue(customerItems.update.notCalled);
  });

  test("cancelling a line keeps the other lines as they are", async ({ assert }) => {
    await setInvoiceLineCancelled("inv1", 1, true);

    const [, patch] = updateInvoice.firstCall.args;
    assert.deepEqual(
      patch.customerItemPayments.map((line: { title: string; cancel?: boolean }) => [
        line.title,
        line.cancel,
      ]),
      [
        ["Psykologi 2 2022", undefined],
        ["Matematikk R1", true],
      ],
    );
  });

  test("cancelling a line that does not exist is refused", async ({ assert }) => {
    await assert.rejects(
      () => setInvoiceLineCancelled("inv1", 5, true),
      /Fakturalinjen finnes ikke/,
    );
  });
});
