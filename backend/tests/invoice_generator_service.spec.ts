import { test } from "@japa/runner";
import { DateTime } from "luxon";
import testUtils from "@adonisjs/core/services/test_utils";

import Invoice from "#models/invoice";
import {
  generateInvoices,
  pupilCustomerNumber,
} from "#services/invoices/invoice_generator_service";
import type CustomerItem from "#models/customer_item";
import type { Branch } from "#shared/branch";
import type { Invoice as InvoiceDto, InvoiceGenerationSettings } from "#shared/invoice";
import type { Item } from "#shared/item";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createInvoice } from "#tests/invoice_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createOrder } from "#tests/order_fixtures";
import { mock } from "#tests/test-doubles";
import { createUser } from "#tests/user_fixtures";

const BRANCH_ID = "5b6442ecd2e733002fae8a44";

/** An unreturned book due inside `rentSettings`' deadline range. */
function customerItem({
  customer,
  item,
  ...overrides
}: Partial<Parameters<typeof createCustomerItem>[0]> & {
  customer: string | null;
  item: string;
}): Promise<CustomerItem> {
  return createCustomerItem({
    customerId: customer,
    itemId: item,
    handoutBranchId: BRANCH_ID,
    type: "rent",
    deadline: DateTime.fromISO("2026-07-01"),
    ...overrides,
  });
}

const KARI_DOB = DateTime.fromISO("2008-02-02");
const customers = [
  {
    id: "c1",
    name: "Kari Nordmann",
    email: "kari@example.com",
    phone: "40000001",
    dob: KARI_DOB,
    address: "Veien 1",
    postalCode: "0001",
  },
  { id: "c2", name: "Ola Nordmann", email: "ola@example.com", phone: "40000002" },
];
const items: Item[] = [
  mock<Item>({ id: "6100000000000000000000b1", title: "Psykologi 2 2022", price: 1049 }),
  mock<Item>({ id: "6100000000000000000000b2", title: "Matematikk R1", price: 899 }),
];
const branch: Partial<Branch> = {
  id: BRANCH_ID,
  name: "Ullern VG3 ST",
  partlyPaymentPeriods: [
    {
      type: "year",
      date: "2027-07-01",
      percentageBuyout: 0.5,
      percentageUpFront: 0.5,
    },
  ],
  buyoutPercentage: 0.6,
};

const rentSettings: InvoiceGenerationSettings = {
  type: "rent",
  deadlineFrom: "2026-06-01",
  deadlineTo: "2026-07-31",
  invoiceNumber: 20_263_000,
  fee: 96,
  feeVatPercentage: 0.25,
  feePercentage: 1.1,
  daysToDeadline: 14,
  reference: "Manglende levering av skolebøker",
};

/** Runs a real generation and reads the saved invoices back, in number order. */
async function generateAndRead(settings: InvoiceGenerationSettings): Promise<InvoiceDto[]> {
  await generateInvoices(settings, false);
  const invoices = await Invoice.query().orderBy("invoice_number");
  return invoices.map((invoice) => invoice.toDto(null));
}

test.group("invoice generation", (group) => {
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    for (const item of items) {
      await createItem({ id: item.id, title: item.title, price: item.price });
    }
    await createBranch(branch);
    for (const customer of customers) {
      await createUser(customer);
    }
  });

  test("selects unreturned, not bought out books of the type with a deadline in the range", async ({
    assert,
  }) => {
    const book = "6100000000000000000000b1";
    await customerItem({ id: "due", customer: "c1", item: book });
    await customerItem({ id: "returned", customer: "c1", item: book, returned: true });
    await customerItem({ id: "bought-out", customer: "c1", item: book, buyout: true });
    await customerItem({ id: "partly", customer: "c1", item: book, type: "partly-payment" });
    await customerItem({
      id: "later",
      customer: "c1",
      item: book,
      deadline: DateTime.fromISO("2026-08-01"),
    });

    const invoices = await generateAndRead(rentSettings);

    assert.deepEqual(
      invoices.flatMap((invoice) => invoice.lines.map((line) => line.customerItemId)),
      ["due"],
    );
  });

  test("one invoice per customer, numbered in order, with legacy bl-admin's rent arithmetic", async ({
    assert,
  }) => {
    await customerItem({ id: "ci1", customer: "c1", item: "6100000000000000000000b1" });
    await customerItem({ id: "ci2", customer: "c2", item: "6100000000000000000000b2" });
    await customerItem({ id: "ci3", customer: "c1", item: "6100000000000000000000b2" });

    const { skipped } = await generateInvoices(rentSettings, true);
    assert.lengthOf(skipped, 0);
    const invoices = await generateAndRead(rentSettings);

    assert.deepEqual(
      invoices.map((invoice) => [invoice.invoiceNumber, invoice.customerName]),
      [
        ["20263000", "Kari Nordmann"],
        ["20263001", "Ola Nordmann"],
      ],
    );
    const [kari] = invoices;
    assert.deepInclude(kari, {
      type: "rent",
      branchId: BRANCH_ID,
      reference: rentSettings.reference,
      customerId: "c1",
      customerNumber: pupilCustomerNumber("c1"),
      customerName: "Kari Nordmann",
      customerEmail: "kari@example.com",
      customerPhone: "40000001",
      customerDob: KARI_DOB.toISODate(),
      customerAddress: "Veien 1",
      customerPostalCode: "0001",
      customerCountry: null,
      customerOrganizationNumber: null,
    });
    assert.deepEqual(
      kari?.lines.map((line) => [
        line.customerItemId,
        line.title,
        {
          unit: line.unit,
          gross: line.gross,
          net: line.net,
          vat: line.vat,
          discount: line.discount,
        },
      ]),
      [
        // 1049 * 1.1 = 1153.9, rounded to whole kroner
        ["ci1", "Psykologi 2 2022", { unit: 1049, gross: 1154, net: 1154, vat: 0, discount: 0 }],
        ["ci3", "Matematikk R1", { unit: 899, gross: 989, net: 989, vat: 0, discount: 0 }],
      ],
    );
    // Two books: fee 2 * 96 = 192 net, 48 VAT
    assert.deepInclude(kari, {
      feeUnit: 96,
      feeNet: 192,
      feeVat: 48,
      feeGross: 240,
      feeDiscount: 0,
      totalGross: 2383,
      totalNet: 2335,
      totalVat: 48,
      totalDiscount: 0,
      totalIncludingFee: 2383,
      status: "unpaid",
    });
  });

  test("a dry run saves nothing; a real run saves every invoice", async ({ assert }) => {
    await customerItem({ id: "ci1", customer: "c1", item: "6100000000000000000000b1" });

    const preview = await generateInvoices(rentSettings, true);
    assert.lengthOf(await Invoice.all(), 0);
    assert.equal(preview.invoices[0]?.id, "20263000");

    const { invoices } = await generateInvoices(rentSettings, false);
    const saved = await Invoice.all();
    assert.lengthOf(saved, 1);
    assert.equal(invoices[0]?.id, saved[0]?.id);
    assert.deepInclude(invoices[0], {
      invoiceNumber: "20263000",
      customerName: "Kari Nordmann",
      customerId: "c1",
      totalIncludingFee: 1274,
      status: "unpaid",
    });
  });

  test("a run that would reuse an invoice number is refused before anything is saved", async ({
    assert,
  }) => {
    await customerItem({ id: "ci1", customer: "c1", item: "6100000000000000000000b1" });
    await createInvoice({ invoiceNumber: "20263000" });

    await assert.rejects(
      () => generateInvoices(rentSettings, true),
      /Fakturanummer 20263000 er allerede i bruk/,
    );
    await assert.rejects(() => generateInvoices(rentSettings, false), /allerede i bruk/);
    assert.lengthOf(await Invoice.all(), 1);
  });

  test("partly-payment lines invoice the amount left to pay, without a percentage", async ({
    assert,
  }) => {
    await customerItem({
      id: "ci1",
      customer: "c1",
      item: "6100000000000000000000b1",
      type: "partly-payment",
      amountLeftToPay: 310,
    });

    const [invoice] = await generateAndRead({
      ...rentSettings,
      type: "partly-payment",
      fee: 320,
      feePercentage: 0.33,
    });

    assert.deepInclude(invoice?.lines[0], { unit: 310, gross: 310, net: 310, vat: 0, discount: 0 });
    assert.deepInclude(invoice, {
      feeUnit: 320,
      feeNet: 320,
      feeVat: 80,
      feeGross: 400,
      feeDiscount: 0,
    });
  });

  test("a partly-payment book with no stored amount is priced from the period's buyout percentage", async ({
    assert,
  }) => {
    await customerItem({
      id: "ci1",
      customer: "c1",
      item: "6100000000000000000000b1",
      type: "partly-payment",
      amountLeftToPay: 0,
    });
    await createOrder({
      id: "order1",
      branchId: BRANCH_ID,
      customerId: null,
      orderItems: [
        {
          type: "partly-payment",
          itemId: "6100000000000000000000b1",
          customerItemId: "ci1",
          periodType: "year",
        },
      ],
    });

    const [invoice] = await generateAndRead({ ...rentSettings, type: "partly-payment" });

    // 1049 * 0.5 = 524.5, floored to a multiple of ten
    assert.equal(invoice?.lines[0]?.gross, 520);
  });

  test("books whose customer no longer exists are skipped and reported", async ({ assert }) => {
    await customerItem({ id: "ci1", customer: null, item: "6100000000000000000000b1" });
    await customerItem({ id: "ci2", customer: "c2", item: "6100000000000000000000b2" });

    const { invoices, skipped } = await generateInvoices(rentSettings, true);

    assert.lengthOf(invoices, 1);
    assert.equal(invoices[0]?.invoiceNumber, "20263000");
    assert.deepEqual(skipped, [{ customerItemId: "ci1", reason: "Kunden finnes ikke lenger." }]);
  });
});
