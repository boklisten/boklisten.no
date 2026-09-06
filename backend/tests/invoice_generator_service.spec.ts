import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { generateInvoices } from "#services/invoices/invoice_generator_service";
import { StorageService } from "#services/storage_service";
import type { Branch } from "#shared/branch";
import type { CustomerItem } from "#shared/customer-item/customer-item";
import type { InvoiceGenerationSettings } from "#shared/invoice";
import type { Item } from "#shared/item";
import type { Order } from "#shared/order/order";
import type { UserDetail } from "#shared/user-detail";
import { mock } from "#tests/test-doubles";

const BRANCH_ID = "5b6442ecd2e733002fae8a44";

function customerItem(overrides: Partial<CustomerItem>): CustomerItem {
  return mock<CustomerItem>({
    type: "rent",
    handout: true,
    returned: false,
    buyout: false,
    orders: ["order1"],
    deadline: new Date("2026-06-30T22:00:00.000Z"),
    handoutInfo: { handoutBy: "branch", handoutById: BRANCH_ID, time: new Date() },
    ...overrides,
  });
}

const customers: UserDetail[] = [
  mock<UserDetail>({
    id: "c1",
    name: "Kari Nordmann",
    email: "kari@example.com",
    phone: "40000001",
    dob: new Date("2008-02-02T00:00:00.000Z"),
    address: "Veien 1",
    postCode: "0001",
    postCity: "Oslo",
  }),
  mock<UserDetail>({ id: "c2", name: "Ola Nordmann", email: "ola@example.com", phone: "40000002" }),
];
const items: Item[] = [
  mock<Item>({ id: "i1", title: "Psykologi 2 2022", price: 1049 }),
  mock<Item>({ id: "i2", title: "Matematikk R1", price: 899 }),
];
const branch = mock<Branch>({
  id: BRANCH_ID,
  name: "Ullern VG3 ST",
  paymentInfo: {
    responsible: false,
    rentPeriods: [],
    extendPeriods: [],
    partlyPaymentPeriods: [
      {
        type: "year",
        date: new Date(),
        percentageBuyout: 0.5,
        percentageBuyoutUsed: 0.5,
        percentageUpFront: 0.5,
        percentageUpFrontUsed: 0.5,
      },
    ],
    buyout: { percentage: 0.6 },
  },
});

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
  let aggregate: sinon.SinonStub;
  let addInvoice: sinon.SinonStub;
  let getOrders: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    aggregate = sandbox.stub().resolves([]);
    sandbox.stub(StorageService, "CustomerItems").value({ aggregate });
    sandbox.stub(StorageService, "UserDetails").value({
      getMany: sandbox.stub().resolves(customers),
    });
    sandbox.stub(StorageService, "Items").value({ getMany: sandbox.stub().resolves(items) });
    sandbox.stub(StorageService, "Branches").value({ getMany: sandbox.stub().resolves([branch]) });
    getOrders = sandbox.stub().resolves([]);
    sandbox.stub(StorageService, "Orders").value({ getMany: getOrders });
    addInvoice = sandbox
      .stub()
      .callsFake((invoice) => Promise.resolve({ ...invoice, id: "saved" }));
    sandbox.stub(StorageService, "Invoices").value({ add: addInvoice });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("selects unreturned, not bought out books of the type with a deadline in the range", async () => {
    await generateInvoices(rentSettings, true);

    const [pipeline] = aggregate.firstCall.args;
    const match = pipeline[0].$match;
    if (match.returned !== false || match.buyout !== false || match.type !== "rent") {
      throw new Error(`unexpected match ${JSON.stringify(match)}`);
    }
    if (
      match.deadline.$gte.getTime() !== rentSettings.deadlineFrom.getTime() ||
      match.deadline.$lte.getTime() !== rentSettings.deadlineTo.getTime()
    ) {
      throw new Error("deadline range not applied");
    }
  });

  test("one invoice per customer, numbered in order, with bl-admin's rent arithmetic", async ({
    assert,
  }) => {
    aggregate.resolves([
      customerItem({ id: "ci1", customer: "c1", item: "i1" }),
      customerItem({ id: "ci2", customer: "c2", item: "i2" }),
      customerItem({ id: "ci3", customer: "c1", item: "i2" }),
    ]);

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
      dob: new Date("2008-02-02T00:00:00.000Z"),
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
    aggregate.resolves([customerItem({ id: "ci1", customer: "c1", item: "i1" })]);

    await generateInvoices(rentSettings, true);
    assert.isTrue(addInvoice.notCalled);

    const { invoices } = await generateInvoices(rentSettings, false);
    assert.equal(addInvoice.callCount, 1);
    assert.equal(invoices[0]?.id, "saved");
  });

  test("partly-payment lines invoice the amount left to pay, without a percentage", async ({
    assert,
  }) => {
    aggregate.resolves([
      customerItem({
        id: "ci1",
        customer: "c1",
        item: "i1",
        type: "partly-payment",
        amountLeftToPay: 310,
      }),
    ]);

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
    aggregate.resolves([
      customerItem({
        id: "ci1",
        customer: "c1",
        item: "i1",
        type: "partly-payment",
        amountLeftToPay: 0,
      }),
    ]);
    getOrders.resolves([
      mock<Order>({
        id: "order1",
        orderItems: [{ customerItem: "ci1", item: "i1", info: { periodType: "year" } }],
      }),
    ]);

    const { invoices } = await generateInvoices({ ...rentSettings, type: "partly-payment" }, true);

    // 1049 * 0.5 = 524.5, floored to a multiple of ten
    assert.equal(invoices[0]?.customerItemPayments[0]?.payment.gross, 520);
  });

  test("books whose customer no longer exists are skipped and reported", async ({ assert }) => {
    aggregate.resolves([
      customerItem({ id: "ci1", customer: "gone", item: "i1" }),
      customerItem({ id: "ci2", customer: "c2", item: "i2" }),
    ]);

    const { invoices, skipped } = await generateInvoices(rentSettings, true);

    assert.lengthOf(invoices, 1);
    assert.equal(invoices[0]?.invoiceId, "20263000");
    assert.deepEqual(skipped, [
      { customerItemId: "ci1", reason: "Kunden gone finnes ikke lenger." },
    ]);
  });
});
