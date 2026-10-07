import testUtils from "@adonisjs/core/services/test_utils";
import db from "@adonisjs/lucid/services/db";
import { test } from "@japa/runner";
import { DateTime } from "luxon";

import BookDetailsService from "#services/book_details_service";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { fixtureId } from "#tests/fixtures";
import { createInvoice } from "#tests/invoice_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createUser } from "#tests/user_fixtures";

const CUSTOMER = fixtureId("c1");
const OTHER = fixtureId("c2");
const PEER = fixtureId("c3");
const EMPLOYEE = fixtureId("c4");
const ITEM = fixtureId("a1");
const BRANCH = fixtureId("b1");
const HANDED_OUT = DateTime.fromISO("2026-08-20T10:15:30");

async function handedOutBook() {
  const customerItem = await createCustomerItem({
    itemId: ITEM,
    customerId: CUSTOMER,
    handoutBranchId: BRANCH,
    handoutEmployeeId: EMPLOYEE,
    handedOutAt: HANDED_OUT,
    deadline: DateTime.fromISO("2026-12-20"),
  });
  const order = await createOrder({
    branchId: BRANCH,
    customerId: CUSTOMER,
    createdAt: HANDED_OUT,
    orderItems: [
      {
        itemId: ITEM,
        customerItemId: customerItem.id,
        handout: true,
        periodTo: DateTime.fromISO("2026-12-20"),
      },
    ],
  });
  return { customerItem, order };
}

test.group("BookDetailsService.forCustomerItem", (group) => {
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createItem({ id: ITEM, title: "Mønster 1T", isbn: 9_788_202_696_153 });
    await createBranch({ id: BRANCH, name: "Ullern VGS" });
    await createUser({ id: CUSTOMER });
    await createUser({ id: OTHER });
    await createUser({ id: PEER, name: "Ola Nordmann" });
    await createUser({ id: EMPLOYEE, name: "Ansatt Ansattsen" });
  });

  test("hides another customer's book", async ({ assert }) => {
    const { customerItem } = await handedOutBook();
    assert.isNull(
      await BookDetailsService.forCustomerItem(customerItem.id, {
        role: "customer",
        userId: OTHER,
      }),
    );
  });

  test("names the employee to the stand but not to the customer", async ({ assert }) => {
    const { customerItem } = await handedOutBook();
    const employeeView = await BookDetailsService.forCustomerItem(customerItem.id, {
      role: "employee",
    });
    const customerView = await BookDetailsService.forCustomerItem(customerItem.id, {
      role: "customer",
      userId: CUSTOMER,
    });
    assert.deepEqual(employeeView?.handout.by, {
      kind: "employee",
      userId: EMPLOYEE,
      name: "Ansatt Ansattsen",
    });
    assert.isNull(customerView?.handout.by);
    assert.equal(customerView?.isbn, "9788202696153");
  });

  test("names the student the book came from in an overlevering", async ({ assert }) => {
    const { customerItem, order } = await handedOutBook();
    await db.table("book_handovers").insert({
      blid: null,
      from_user_id: PEER,
      to_user_id: CUSTOMER,
      item_id: ITEM,
      order_id: order.id,
      occurred_at: HANDED_OUT.toJSDate(),
      created_at: new Date(),
      updated_at: new Date(),
    });
    const customerView = await BookDetailsService.forCustomerItem(customerItem.id, {
      role: "customer",
      userId: CUSTOMER,
    });
    assert.deepEqual(customerView?.handout.by, {
      kind: "peer",
      userId: null,
      name: "Ola Nordmann",
    });
  });

  test("tells a cancelled book from a returned one", async ({ assert }) => {
    const { customerItem } = await handedOutBook();
    // A cancellation also marks the book returned, as every cancelled row on production is
    await db
      .from("customer_items")
      .where("id", customerItem.id)
      .update({
        returned: true,
        cancel: true,
        cancelled_at: HANDED_OUT.plus({ days: 1 }).toJSDate(),
      });
    const details = await BookDetailsService.forCustomerItem(customerItem.id, { role: "employee" });
    assert.equal(details?.ended?.kind, "cancel");
    assert.deepEqual(details?.status, { type: "cancel", text: "Kansellert" });
  });

  test("lists standing invoices only, newest first", async ({ assert }) => {
    const { customerItem } = await handedOutBook();
    await createInvoice({
      status: "paid",
      lines: [{ customerItemId: customerItem.id, gross: 400 }],
    });
    const withCancelledLine = await createInvoice({ lines: [{ customerItemId: customerItem.id }] });
    await db
      .from("invoice_lines")
      .where("invoice_id", withCancelledLine.id)
      .update({ cancelled: true });
    await createInvoice({
      status: "credit-note",
      lines: [{ customerItemId: customerItem.id }],
    });
    const details = await BookDetailsService.forCustomerItem(customerItem.id, {
      role: "employee",
    });
    assert.deepEqual(
      details?.invoices.map(({ status, amount }) => ({ status, amount })),
      [{ status: "paid", amount: 400 }],
    );
    const summaries = await BookDetailsService.invoiceSummariesOf([customerItem.id]);
    assert.equal(summaries.get(customerItem.id)?.status, "paid");
  });
});

test.group("BookDetailsService.forOrderedItem", (group) => {
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createItem({ id: ITEM, title: "Mønster 1T" });
    await createBranch({ id: BRANCH, name: "Ullern VGS" });
    await createUser({ id: CUSTOMER });
    await createUser({ id: OTHER });
  });

  test("shows a book still on the order, to its customer only", async ({ assert }) => {
    const order = await createOrder({
      branchId: BRANCH,
      customerId: CUSTOMER,
      byCustomer: true,
      orderItems: [{ itemId: ITEM, periodTo: DateTime.fromISO("2027-07-01"), amount: 0 }],
    });
    const details = await BookDetailsService.forOrderedItem(order.id, ITEM, {
      role: "customer",
      userId: CUSTOMER,
    });
    assert.include(details, { kind: "ordered", deadline: "2027-07-01", type: "rent" });
    assert.deepEqual(details?.branch, { id: BRANCH, name: "Ullern VGS" });
    assert.isNull(
      await BookDetailsService.forOrderedItem(order.id, ITEM, { role: "customer", userId: OTHER }),
    );
  });

  test("has no details once the book is handed out", async ({ assert }) => {
    const order = await createOrder({
      branchId: BRANCH,
      customerId: CUSTOMER,
      orderItems: [{ itemId: ITEM, handout: true }],
    });
    assert.isNull(await BookDetailsService.forOrderedItem(order.id, ITEM, { role: "employee" }));
  });
});
