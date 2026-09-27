import { test } from "@japa/runner";
import { DateTime } from "luxon";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { generateInvoices } from "#services/invoices/invoice_generator_service";
import { StorageService } from "#services/storage_service";
import type CustomerItem from "#models/customer_item";
import type { Branch } from "#shared/branch";
import type { InvoiceGenerationSettings } from "#shared/invoice";
import type { Item } from "#shared/item";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
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
    deadline: DateTime.fromISO("2026-06-30T22:00:00.000Z"),
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
    postCode: "0001",
    postCity: "Oslo",
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
      date: new Date(),
      percentageBuyout: 0.5,
      percentageUpFront: 0.5,
    },
  ],
  buyoutPercentage: 0.6,
};

const rentSettings: InvoiceGenerationSettings = {
  type: "rent",
  deadlineFrom: new Date("2026-06-01T00:00:00.000Z"),
  deadlineTo: new Date("2026-07-31T23:59:59.999Z"),
  invoiceNumber: 20_263_000,
  fee: 96,
  feeVatPercentage: 0.25,
  feePercentage: 1.1,
  daysToDeadline: 14,
  reference: "Manglende levering av skolebøker",
};

test.group("invoice generation", (group) => {
  let sandbox: sinon.SinonSandbox;
  let addInvoice: sinon.SinonStub;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    for (const item of items) {
      await createItem({ id: item.id, title: item.title, price: item.price });
    }
    await createBranch(branch);
    for (const customer of customers) {
      await createUser(customer);
    }
    sandbox = createSandbox();
    addInvoice = sandbox
      .stub()
      .callsFake((invoice) => Promise.resolve({ ...invoice, id: "saved" }));
    sandbox.stub(StorageService, "Invoices").value({ add: addInvoice });
  });
  group.each.teardown(() => {
    sandbox.restore();
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
      deadline: DateTime.fromISO("2026-08-01T00:00:00.000Z"),
    });

    const { invoices } = await generateInvoices(rentSettings, true);

    assert.deepEqual(
      invoices.flatMap((invoice) => invoice.customerItemPayments.map((line) => line.customerItem)),
      ["due"],
    );
  });

  test("one invoice per customer, numbered in order, with legacy bl-admin's rent arithmetic", async ({
    assert,
  }) => {
    await customerItem({ id: "ci1", customer: "c1", item: "6100000000000000000000b1" });
    await customerItem({ id: "ci2", customer: "c2", item: "6100000000000000000000b2" });
    await customerItem({ id: "ci3", customer: "c1", item: "6100000000000000000000b2" });

    const { invoices, skipped } = await generateInvoices(rentSettings, true);

    assert.lengthOf(skipped, 0);
    assert.deepEqual(
      invoices.map((invoice) => [invoice.invoiceId, invoice.customerInfo.name]),
      [
        ["20263000", "Kari Nordmann"],
        ["20263001", "Ola Nordmann"],
      ],
    );
    const [kari] = invoices;
    assert.equal(kari?.type, "rent");
    assert.equal(kari?.branch, BRANCH_ID);
    assert.equal(kari?.reference, rentSettings.reference);
    assert.deepEqual(kari?.customerInfo, {
      userDetail: "c1",
      name: "Kari Nordmann",
      email: "kari@example.com",
      phone: "40000001",
      dob: KARI_DOB.toJSDate(),
      postal: { address: "Veien 1", city: "Oslo", code: "0001" },
    });
    assert.deepEqual(
      kari?.customerItemPayments.map((line) => [line.customerItem, line.title, line.payment]),
      [
        // 1049 * 1.1 = 1153.9, rounded to whole kroner
        ["ci1", "Psykologi 2 2022", { unit: 1049, gross: 1154, net: 1154, vat: 0, discount: 0 }],
        ["ci3", "Matematikk R1", { unit: 899, gross: 989, net: 989, vat: 0, discount: 0 }],
      ],
    );
    // Two books: fee 2 * 96 = 192 net, 48 VAT
    assert.deepEqual(kari?.payment.fee, { unit: 96, net: 192, vat: 48, gross: 240, discount: 0 });
    assert.deepEqual(kari?.payment.total, { gross: 2383, net: 2335, vat: 48, discount: 0 });
    assert.equal(kari?.payment.totalIncludingFee, 2383);
    assert.isFalse(kari?.customerHavePayed);
  });

  test("a dry run saves nothing; a real run saves every invoice", async ({ assert }) => {
    await customerItem({ id: "ci1", customer: "c1", item: "6100000000000000000000b1" });

    await generateInvoices(rentSettings, true);
    assert.isTrue(addInvoice.notCalled);

    const { invoices } = await generateInvoices(rentSettings, false);
    assert.equal(addInvoice.callCount, 1);
    assert.equal(invoices[0]?.id, "saved");
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

    const { invoices } = await generateInvoices(
      { ...rentSettings, type: "partly-payment", fee: 320, feePercentage: 0.33 },
      true,
    );

    assert.deepEqual(invoices[0]?.customerItemPayments[0]?.payment, {
      unit: 310,
      gross: 310,
      net: 310,
      vat: 0,
      discount: 0,
    });
    assert.deepEqual(invoices[0]?.payment.fee, {
      unit: 320,
      net: 320,
      vat: 80,
      gross: 400,
      discount: 0,
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

    const { invoices } = await generateInvoices({ ...rentSettings, type: "partly-payment" }, true);

    // 1049 * 0.5 = 524.5, floored to a multiple of ten
    assert.equal(invoices[0]?.customerItemPayments[0]?.payment.gross, 520);
  });

  test("books whose customer no longer exists are skipped and reported", async ({ assert }) => {
    await customerItem({ id: "ci1", customer: null, item: "6100000000000000000000b1" });
    await customerItem({ id: "ci2", customer: "c2", item: "6100000000000000000000b2" });

    const { invoices, skipped } = await generateInvoices(rentSettings, true);

    assert.lengthOf(invoices, 1);
    assert.equal(invoices[0]?.invoiceId, "20263000");
    assert.deepEqual(skipped, [{ customerItemId: "ci1", reason: "Kunden finnes ikke lenger." }]);
  });
});
