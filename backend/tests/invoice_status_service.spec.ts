import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import Branch from "#models/branch";
import CustomerItem from "#models/customer_item";
import Invoice from "#models/invoice";
import InvoiceLine from "#models/invoice_line";
import Order from "#models/order";
import {
  deleteInvoice,
  invoicePaidLineAmount,
  setInvoiceLineCancelled,
  setInvoiceStatus,
  setInvoiceStatuses,
} from "#services/invoices/invoice_status_service";
import { OrderPlacedHandler } from "#services/orders/order_placed_handler";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createInvoice } from "#tests/invoice_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

const CUSTOMER_ID = "6100000000000000000000c1";
const EMPLOYEE_ID = "6100000000000000000000e1";

/** Inserts the invoice for Elise's two books; ci2 is already returned. */
function createEliseInvoice(overrides: Parameters<typeof createInvoice>[0] = {}) {
  return createInvoice({
    id: "inv1",
    invoiceNumber: "20263071",
    branchId: "branch1",
    customerId: CUSTOMER_ID,
    customerName: "Elise Nordmann",
    lines: [
      {
        customerItemId: "ci1",
        itemId: "i1",
        title: "Psykologi 2 2022",
        unit: 1049,
        gross: 1154,
        net: 1154,
      },
      {
        customerItemId: "ci2",
        itemId: "i2",
        title: "Matematikk R1",
        unit: 899,
        gross: 989,
        net: 989,
      },
    ],
    ...overrides,
  });
}

async function flagsOf(invoiceId: string) {
  const { customerHasPaid, toCreditNote, toDebtCollection, toLossNote } =
    await Invoice.getOrFail(invoiceId);
  return { customerHasPaid, toCreditNote, toDebtCollection, toLossNote };
}

/** The buyout flag of each invoiced book, by customer item id. */
async function buyoutFlags() {
  const customerItems = await CustomerItem.query().orderBy("id");
  return customerItems.map((customerItem) => [customerItem.id, customerItem.buyout]);
}

test.group("invoice status changes", (group) => {
  let sandbox: sinon.SinonSandbox;
  let placeOrder: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createBranch({ id: "branch1" });
    await createUser({ id: CUSTOMER_ID });
    await createUser({ id: EMPLOYEE_ID });
    await createItem({ id: "i1", title: "Psykologi 2 2022" });
    await createItem({ id: "i2", title: "Matematikk R1" });
    const invoiced = { customerId: CUSTOMER_ID, handoutBranchId: "branch1" };
    await createCustomerItem({ ...invoiced, id: "ci1", itemId: "i1", blid: "blid1" });
    await createCustomerItem({
      ...invoiced,
      id: "ci2",
      itemId: "i2",
      blid: "blid2",
      returned: true,
    });
    sandbox = createSandbox();
    placeOrder = sandbox
      .stub(OrderPlacedHandler.prototype, "placeOrder")
      .callsFake((order: Order) => Promise.resolve(order));
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("order line amounts are whole kroner truncated to tens, as legacy bl-admin's price service did", ({
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
    await createEliseInvoice();
    const { invoice, warnings } = await setInvoiceStatus("inv1", "paid", EMPLOYEE_ID);

    assert.isTrue(invoice.customerHasPaid);
    assert.equal(invoice.branchName, (await Branch.findOrFail("branch1")).name);
    assert.deepEqual(await flagsOf("inv1"), {
      customerHasPaid: true,
      toCreditNote: false,
      toDebtCollection: false,
      toLossNote: false,
    });
    const [order, ...others] = await Order.all();
    assert.lengthOf(others, 0);
    assert.include(order?.toDto(), {
      amount: 1150,
      branchId: "branch1",
      customerId: CUSTOMER_ID,
      byCustomer: false,
      employeeId: EMPLOYEE_ID,
      // The stub stands in for the placed-order handler
      placed: false,
      notifyByEmail: false,
    });
    assert.deepEqual(
      order?.orderItems.map((orderItem) => {
        const { type, itemId, title, blid, amount, unitPrice, handout, delivered, customerItemId } =
          orderItem.toDto();
        return { type, itemId, title, blid, amount, unitPrice, handout, delivered, customerItemId };
      }),
      [
        {
          type: "invoice-paid",
          itemId: "i1",
          title: "Psykologi 2 2022",
          blid: "blid1",
          amount: 1150,
          unitPrice: 1150,
          handout: true,
          delivered: true,
          customerItemId: "ci1",
        },
      ],
    );
    assert.equal(placeOrder.firstCall.args[0].id, order?.id);
    assert.deepEqual(await buyoutFlags(), [
      ["ci1", true],
      ["ci2", true],
    ]);
    assert.deepEqual(warnings, []);
  });

  test("marking paid when no book is active still sets the flags, with a warning", async ({
    assert,
  }) => {
    await createEliseInvoice();
    await CustomerItem.query().where("id", "ci1").update({ returned: true });

    const { warnings } = await setInvoiceStatus("inv1", "paid", EMPLOYEE_ID);

    assert.lengthOf(await Order.all(), 0);
    assert.lengthOf(warnings, 1);
    assert.isTrue((await flagsOf("inv1")).customerHasPaid);
  });

  test("leaving paid removes the invoice-paid order from the customer and clears buyout", async ({
    assert,
  }) => {
    await createEliseInvoice({ customerHasPaid: true });
    await createOrder({
      id: "unrelated",
      branchId: "branch1",
      customerId: CUSTOMER_ID,
      orderItems: [{ type: "rent", itemId: "i1" }],
    });
    await createOrder({
      id: "order1",
      branchId: "branch1",
      customerId: CUSTOMER_ID,
      orderItems: [
        { type: "invoice-paid", itemId: "i1" },
        { type: "invoice-paid", itemId: "i2" },
      ],
    });

    const { warnings } = await setInvoiceStatus("inv1", "creditNote", EMPLOYEE_ID);

    assert.deepEqual(await flagsOf("inv1"), {
      customerHasPaid: false,
      toCreditNote: true,
      toDebtCollection: false,
      toLossNote: false,
    });
    assert.deepEqual(
      (await Order.all()).map((order) => order.id),
      ["unrelated"],
    );
    assert.deepEqual(await buyoutFlags(), [
      ["ci1", false],
      ["ci2", false],
    ]);
    assert.deepEqual(warnings, []);
  });

  test("leaving paid without a matching order warns instead of failing", async ({ assert }) => {
    await createEliseInvoice({ customerHasPaid: true });

    await createOrder({
      id: "unrelated",
      branchId: "branch1",
      customerId: CUSTOMER_ID,
      orderItems: [{ type: "rent", itemId: "i1" }],
    });

    const { warnings } = await setInvoiceStatus("inv1", "unpaid", EMPLOYEE_ID);

    assert.lengthOf(await Order.all(), 1);
    assert.lengthOf(warnings, 1);
  });

  test("leaving paid for a deleted customer warns instead of failing", async ({ assert }) => {
    await createEliseInvoice({ customerHasPaid: true, customerId: null });

    const { warnings } = await setInvoiceStatus("inv1", "unpaid", EMPLOYEE_ID);

    assert.deepEqual(warnings, ["Fant ingen ordre for betalingen å fjerne fra kunden."]);
    assert.deepEqual(await buyoutFlags(), [
      ["ci1", false],
      ["ci2", false],
    ]);
  });

  test("changing between the other statuses touches nothing but the flags", async ({ assert }) => {
    await createEliseInvoice();
    await setInvoiceStatus("inv1", "debtCollection", EMPLOYEE_ID);

    assert.isTrue((await flagsOf("inv1")).toDebtCollection);
    assert.lengthOf(await Order.all(), 0);
    assert.deepEqual(await buyoutFlags(), [
      ["ci1", false],
      ["ci2", false],
    ]);
  });

  test("a bulk change applies to every invoice in order and names the invoice in each warning", async ({
    assert,
  }) => {
    await createEliseInvoice();
    await createInvoice({
      id: "inv2",
      invoiceNumber: "20263072",
      customerId: CUSTOMER_ID,
      customerHasPaid: true,
    });

    const { invoices, warnings } = await setInvoiceStatuses(
      ["inv1", "inv2"],
      "lossNote",
      EMPLOYEE_ID,
    );

    assert.deepEqual(
      invoices.map((updated) => [updated.id, updated.toLossNote]),
      [
        ["inv1", true],
        ["inv2", true],
      ],
    );
    assert.deepEqual(warnings, ["20263072: Fant ingen ordre for betalingen å fjerne fra kunden."]);
  });

  test("cancelling a line keeps the other lines as they are", async ({ assert }) => {
    await createEliseInvoice();
    const updated = await setInvoiceLineCancelled("inv1", 1, true);

    const expected = [
      ["Psykologi 2 2022", false],
      ["Matematikk R1", true],
    ];
    assert.deepEqual(
      updated.lines.map((line) => [line.title, line.cancel]),
      expected,
    );
    assert.deepEqual(
      (await Invoice.getOrFail("inv1")).lines.map((line) => [line.title, line.cancel]),
      expected,
    );
  });

  test("cancelling a line that does not exist is refused", async ({ assert }) => {
    await createEliseInvoice();
    await assert.rejects(
      () => setInvoiceLineCancelled("inv1", 5, true),
      /Fakturalinjen finnes ikke/,
    );
  });

  test("an unpaid invoice can be deleted, lines and all", async ({ assert }) => {
    await createEliseInvoice();
    await deleteInvoice("inv1");
    assert.lengthOf(await Invoice.all(), 0);
    assert.lengthOf(await InvoiceLine.all(), 0);
  });

  test("deleting an invoice that is not unpaid is refused", async ({ assert }) => {
    for (const [index, flags] of [
      { customerHasPaid: true },
      { toCreditNote: true },
      { toDebtCollection: true },
      { toLossNote: true },
    ].entries()) {
      const { id } = await createInvoice({ id: `kept${index}`, ...flags });
      await assert.rejects(() => deleteInvoice(id), /Bare ubetalte fakturaer kan slettes/);
    }
    assert.lengthOf(await Invoice.all(), 4);
  });
});
