import type { HttpContext } from "@adonisjs/core/http";
import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import ReportsController from "#controllers/reports_controller";
import { OrderPayments } from "#services/payments/order_payments";
import type { Payment } from "#shared/payment/payment";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { mock } from "#tests/test-doubles";
import { createUser } from "#tests/user_fixtures";

function contextFor(filter: {
  branchFilter?: string[];
  createdAfter?: string;
  createdBefore?: string;
}) {
  return mock<HttpContext>({ request: { validateUsing: () => Promise.resolve(filter) } });
}

test.group("ReportsController.orders", (group) => {
  let sandbox: sinon.SinonSandbox;
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    return () => sandbox.restore();
  });

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
    const byOrder = sandbox.stub(OrderPayments, "byOrder").resolves(
      new Map([
        [paid.id, [mock<Payment>({ confirmed: true })]],
        [unconfirmed.id, [mock<Payment>({ confirmed: false })]],
      ]),
    );

    const rows = await new ReportsController().orders(
      contextFor({ branchFilter: [branch.id], createdAfter: "2026-08-01T00:00:00Z" }),
    );

    assert.sameMembers([...byOrder.firstCall.args[0]], [paid.id, unconfirmed.id]);
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
