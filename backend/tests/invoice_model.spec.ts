import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import Invoice from "#models/invoice";
import { countInvoiceRows } from "#services/branch_insights_service";
import { getInvoice, listInvoices } from "#services/invoices/invoice_query_service";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { fixtureId } from "#tests/fixtures";
import { createInvoice } from "#tests/invoice_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createUser } from "#tests/user_fixtures";

test.group("Invoice model", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("reads the lines back in print order with øre amounts as numbers", async ({ assert }) => {
    const { id } = await createInvoice({
      totalGross: 17_365.7,
      lines: [
        { title: "Bios 1 2021", gross: 8493.2, discount: 60 },
        { title: "Terra nova 2020", gross: 4675, discount: 50 },
      ],
    });

    const invoice = await Invoice.getOrFail(id);

    assert.strictEqual(invoice.totalGross, 17_365.7);
    assert.deepEqual(
      invoice.lines.map((line) => [line.position, line.title, line.gross, line.discount]),
      [
        [0, "Bios 1 2021", 8493.2, 60],
        [1, "Terra nova 2020", 4675, 50],
      ],
    );
  });

  test("an invoice carries the whole fee or none of it", async ({ assert }) => {
    await createInvoice({
      feeUnit: null,
      feeGross: null,
      feeNet: null,
      feeVat: null,
      feeDiscount: null,
    });

    await assert.rejects(() => createInvoice({ feeUnit: null }), /invoices_fee_complete/);
  });

  test("an invoice asks for money until it is paid or credited", async ({ assert }) => {
    const customer = await createUser();
    const other = await createUser();

    assert.isFalse(await Invoice.hasActive(customer.id));
    await createInvoice({ customerId: customer.id, status: "paid" });
    await createInvoice({ customerId: customer.id, status: "credit-note" });
    await createInvoice({ customerId: other.id });
    assert.isFalse(await Invoice.hasActive(customer.id));

    await createInvoice({ customerId: customer.id, status: "debt-collection" });
    assert.isTrue(await Invoice.hasActive(customer.id));
  });

  test("a second invoice with a number already in use is refused", async ({ assert }) => {
    await createInvoice({ invoiceNumber: "20263001" });

    await assert.rejects(
      () => createInvoice({ invoiceNumber: "20263001" }),
      /Fakturanummer 20263001 er allerede i bruk/,
    );
    assert.lengthOf(await Invoice.all(), 1);
  });

  test("the API shows the branch's current name", async ({ assert }) => {
    const branch = await createBranch({ name: "Ullern VG3 ST" });
    const { id } = await createInvoice({ branchId: branch.id });
    await branch.merge({ name: "Ullern VG3" }).save();

    assert.equal((await getInvoice(id)).branchName, "Ullern VG3");
  });

  test("the list is ordered by number and tells company invoices by their org number", async ({
    assert,
  }) => {
    const customer = await createUser();
    await createInvoice({
      id: fixtureId("b2"),
      invoiceNumber: "20268001",
      customerOrganizationNumber: "988982857",
    });
    await createInvoice({
      id: fixtureId("b1"),
      invoiceNumber: "20263001",
      customerId: customer.id,
      totalIncludingFee: 1274.5,
      status: "loss-note",
    });

    const rows = await listInvoices();

    assert.deepEqual(
      rows.map((row) => [
        row.invoiceNumber,
        row.customerId,
        row.customerOrganizationNumber,
        row.status,
      ]),
      [
        ["20263001", customer.id, null, "loss-note"],
        ["20268001", null, "988982857", "unpaid"],
      ],
    );
    assert.strictEqual(rows[0]?.totalIncludingFee, 1274.5);
  });
});

test.group("branch insights: invoiced books", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("counts the book lines of the branches' invoices per year in Oslo time", async ({
    assert,
  }) => {
    const [branch, otherBranch, item] = await Promise.all([
      createBranch(),
      createBranch(),
      createItem(),
    ]);
    const customerItem = await createCustomerItem({
      itemId: item.id,
      customerId: null,
      handoutBranchId: branch.id,
    });
    const book = { customerItemId: customerItem.id, itemId: item.id };
    // 23:30 UTC on New Year's Eve is already 2026 in Oslo.
    await createInvoice({
      branchId: branch.id,
      createdAt: DateTime.fromISO("2025-12-31T23:30:00Z"),
      lines: [book, book],
    });
    await createInvoice({
      branchId: branch.id,
      createdAt: DateTime.fromISO("2025-06-01T10:00:00Z"),
      status: "credit-note",
      // A company line is not a book we lent out.
      lines: [book, { customerItemType: null, title: "Administrasjon" }],
    });
    await createInvoice({ branchId: otherBranch.id, lines: [book] });

    const rows = await countInvoiceRows([branch.id]);

    assert.sameDeepMembers(rows, [
      { year: 2026, count: 2 },
      { year: 2025, count: 1 },
    ]);
  });
});
