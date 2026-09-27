import type { HttpContext } from "@adonisjs/core/http";
import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import ReportsController from "#controllers/reports_controller";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { createPayment } from "#tests/payment_fixtures";
import { mock } from "#tests/test-doubles";
import { createUser } from "#tests/user_fixtures";

function contextFor(filter: Record<string, unknown>) {
  return mock<HttpContext>({ request: { validateUsing: () => Promise.resolve(filter) } });
}

test.group("ReportsController.orders", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("one row per line of the placed orders in range, in the CSV column order", async ({
    assert,
  }) => {
    const [branch, otherBranch, customer, employee, sinus, matte] = await Promise.all([
      createBranch({ name: "Ullern VGS" }),
      createBranch({ name: "Nydalen VGS" }),
      createUser({ name: "Kari" }),
      createUser({ name: "Emil Ansatt", permission: "employee" }),
      createItem({ title: "Sinus 1T" }),
      createItem({ title: "Matte 1P" }),
    ]);
    const paid = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      employeeId: employee.id,
      amount: 300,
      createdAt: DateTime.fromISO("2026-08-10T10:00:00Z"),
      orderItems: [
        { itemId: sinus.id, type: "buy", amount: 200, unitPrice: 200 },
        { itemId: matte.id, amount: 100, unitPrice: 100 },
      ],
    });
    const unconfirmed = await createOrder({
      branchId: branch.id,
      customerId: null,
      amount: 100,
      createdAt: DateTime.fromISO("2026-08-11T10:00:00Z"),
      orderItems: [{ itemId: matte.id, amount: 100, unitPrice: 100 }],
    });
    // Out of scope: unplaced, another branch, before the range.
    await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      placed: false,
      createdAt: DateTime.fromISO("2026-08-12T10:00:00Z"),
      orderItems: [{ itemId: sinus.id }],
    });
    await createOrder({
      branchId: otherBranch.id,
      customerId: customer.id,
      createdAt: DateTime.fromISO("2026-08-12T10:00:00Z"),
      orderItems: [{ itemId: sinus.id }],
    });
    await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      createdAt: DateTime.fromISO("2026-07-01T10:00:00Z"),
      orderItems: [{ itemId: sinus.id }],
    });
    await createPayment({ orderId: paid.id, amount: 300 });
    await createPayment({ orderId: unconfirmed.id, confirmed: false });

    const rows = await new ReportsController().orders(
      contextFor({ branchFilter: [branch.id], createdAfter: "2026-08-01T00:00:00Z" }),
    );

    assert.deepEqual(Object.keys(rows[0] ?? {}), [
      "ordreID",
      "filialID",
      "filialNavn",
      "employeeNavn",
      "customerName",
      "title",
      "ISBN",
      "amount",
      "type",
      "payed",
      "creationTime",
      "pivot",
    ]);
    assert.deepEqual(
      rows.map((row) => [row.ordreID, row.title, row.type, row.amount, row.payed]),
      [
        [paid.id, "Sinus 1T", "buy", 200, true],
        [paid.id, "Matte 1P", "rent", 100, true],
        [unconfirmed.id, "Matte 1P", "rent", 100, false],
      ],
    );
    assert.equal(rows[0]?.filialNavn, "Ullern VGS");
    assert.equal(rows[0]?.employeeNavn, "Emil Ansatt");
    assert.equal(rows[0]?.customerName, "Kari");
    assert.equal(rows[0]?.ISBN, String(sinus.isbn));
    assert.isNull(rows[2]?.customerName);
  });
});

test.group("ReportsController.payments", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("lists the payments in range with their order's customer and branch", async ({ assert }) => {
    const [branch, otherBranch, customer, item] = await Promise.all([
      createBranch({ name: "Ullern VGS" }),
      createBranch({ name: "Nydalen VGS" }),
      createUser({ name: "Kari" }),
      createItem(),
    ]);
    const order = await createOrder({
      branchId: branch.id,
      customerId: customer.id,
      orderItems: [{ itemId: item.id }],
    });
    const deleted = await createOrder({
      branchId: branch.id,
      customerId: null,
      orderItems: [{ itemId: item.id }],
    });
    const elsewhere = await createOrder({
      branchId: otherBranch.id,
      customerId: customer.id,
      orderItems: [{ itemId: item.id }],
    });
    const paid = await createPayment({
      orderId: order.id,
      method: "cash",
      amount: 250,
      createdAt: DateTime.fromISO("2026-08-10T10:00:00Z"),
    });
    const refund = await createPayment({
      orderId: deleted.id,
      method: "vipps-epayment",
      amount: -100,
      confirmed: false,
      createdAt: DateTime.fromISO("2026-08-11T10:00:00Z"),
    });
    // Out of scope: another branch, before the range.
    await createPayment({
      orderId: elsewhere.id,
      createdAt: DateTime.fromISO("2026-08-10T10:00:00Z"),
    });
    await createPayment({ orderId: order.id, createdAt: DateTime.fromISO("2026-07-01T10:00:00Z") });

    const rows = await new ReportsController().payments(
      contextFor({ branchFilter: [branch.id], createdAfter: "2026-08-01T00:00:00Z" }),
    );

    assert.deepEqual(rows, [
      {
        id: paid.id,
        method: "cash",
        amount: 250,
        confirmed: true,
        customerName: "Kari",
        branchName: "Ullern VGS",
        creationTime: new Date("2026-08-10T10:00:00Z"),
        pivot: "1",
      },
      {
        id: refund.id,
        method: "vipps-epayment",
        amount: -100,
        confirmed: false,
        customerName: null,
        branchName: "Ullern VGS",
        creationTime: new Date("2026-08-11T10:00:00Z"),
        pivot: "1",
      },
    ]);
  });
});

test.group("ReportsController.customerItems", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("joins the branch, book, customer and employee in the CSV column order", async ({
    assert,
  }) => {
    const [branch, customer, employee, sinus] = await Promise.all([
      createBranch({ name: "Ullern VGS" }),
      createUser({
        name: "Kari",
        email: "kari@example.com",
        phone: "91234567",
        dob: DateTime.fromISO("2008-03-04"),
        guardianName: "Mor",
      }),
      createUser({ name: "Emil Ansatt", permission: "employee" }),
      createItem({ title: "Sinus 1T" }),
    ]);
    const held = await createCustomerItem({
      itemId: sinus.id,
      customerId: customer.id,
      handoutBranchId: branch.id,
      handoutEmployeeId: employee.id,
      blid: "12345678",
    });
    await createCustomerItem({
      itemId: sinus.id,
      customerId: null,
      handoutBranchId: branch.id,
      returned: true,
    });

    const rows = await new ReportsController().customerItems(
      contextFor({ includeReturned: false, includeBuyout: false }),
    );

    assert.lengthOf(rows, 1);
    assert.deepEqual(Object.keys(rows[0] ?? {}), [
      "id",
      "handoutBranch",
      "handoutTime",
      "lastUpdated",
      "deadline",
      "returned",
      "buyout",
      "blid",
      "title",
      "isbn",
      "name",
      "email",
      "phone",
      "dob",
      "guardianEmail",
      "guardianPhone",
      "guardianName",
      "handoutEmployee",
      "pivot",
    ]);
    assert.deepInclude(rows[0], {
      id: held.id,
      handoutBranch: "Ullern VGS",
      blid: "12345678",
      title: "Sinus 1T",
      isbn: String(sinus.isbn),
      name: "Kari",
      email: "kari@example.com",
      phone: "91234567",
      dob: "2008-03-04",
      guardianName: "Mor",
      handoutEmployee: "Emil Ansatt",
      pivot: "1",
    });
  });
});

test.group("ReportsController.users", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("lists the members of the branches with the branch name", async ({ assert }) => {
    const [branch, otherBranch] = await Promise.all([
      createBranch({ name: "Ullern VGS" }),
      createBranch({ name: "Nydalen VGS" }),
    ]);
    const member = await createUser({
      name: "Kari",
      branchMembershipId: branch.id,
      dob: DateTime.fromISO("2008-03-04"),
    });
    await createUser({ branchMembershipId: otherBranch.id });

    const rows = await new ReportsController().users(contextFor({ branchFilter: [branch.id] }));

    assert.lengthOf(rows, 1);
    assert.deepEqual(Object.keys(rows[0] ?? {}), [
      "id",
      "email",
      "name",
      "phone",
      "address",
      "postCity",
      "postCode",
      "dob",
      "permission",
      "branchMembership",
      "creationTime",
      "pivot",
    ]);
    assert.deepInclude(rows[0], {
      id: member.id,
      name: "Kari",
      dob: "2008-03-04",
      branchMembership: "Ullern VGS",
    });
  });
});
