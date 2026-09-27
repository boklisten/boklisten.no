import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import Company from "#models/company";
import Invoice from "#models/invoice";
import {
  companyInvoiceTotal,
  createCompanyInvoice,
} from "#services/invoices/company_invoice_service";
import { companyLinePayment } from "#shared/invoice";
import type { CompanyInvoiceLine } from "#shared/invoice";
import { createCompany } from "#tests/company_fixtures";
import { fixtureId } from "#tests/fixtures";

/** The lines of a company invoice in staging, so the numbers can be checked against it. */
const KVITSUND_LINES: CompanyInvoiceLine[] = [
  {
    title: "Bios 1 2021",
    productNumber: 1,
    price: 1249,
    numberOfUnits: 17,
    discount: 60,
    taxPercentage: 0,
  },
  {
    title: "Terra nova 2020",
    productNumber: 1,
    price: 935,
    numberOfUnits: 10,
    discount: 50,
    taxPercentage: 0,
  },
  {
    title: "Ganas vol 1",
    productNumber: 1,
    price: 905,
    numberOfUnits: 5,
    discount: 60,
    taxPercentage: 0,
  },
  {
    title: "Momente 2 2020",
    productNumber: 1,
    price: 955,
    numberOfUnits: 5,
    discount: 50,
    taxPercentage: 0,
  },
];

test.group("company invoice arithmetic", () => {
  test("a line is priced as legacy bl-admin did: units times discounted price, two decimals", ({
    assert,
  }) => {
    assert.deepEqual(companyLinePayment(KVITSUND_LINES[0]!), {
      unit: 1249,
      gross: 8493.2,
      net: 8493.2,
      vat: 0,
      discount: 60,
    });
    assert.deepEqual(companyLinePayment(KVITSUND_LINES[3]!), {
      unit: 955,
      gross: 2387.5,
      net: 2387.5,
      vat: 0,
      discount: 50,
    });
  });

  test("VAT is one unit's tax and only the gross is discounted, as before", ({ assert }) => {
    const payment = companyLinePayment({
      title: "Perm",
      productNumber: 2,
      price: 100,
      numberOfUnits: 3,
      discount: 10,
      taxPercentage: 25,
    });

    assert.deepEqual(payment, { unit: 100, gross: 337.5, net: 312.5, vat: 25, discount: 10 });
  });

  test("the total sums every line, including the discounts", ({ assert }) => {
    assert.deepEqual(companyInvoiceTotal(KVITSUND_LINES), {
      gross: 17_365.7,
      net: 17_365.7,
      vat: 0,
      discount: 220,
    });
  });
});

test.group("company invoice creation", (group) => {
  let companyId: string;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    companyId = (
      await createCompany({
        name: "Kvitsund Gymnas",
        organizationNumber: "988982857",
        customerNumber: "988982857",
        email: "bibliotek@kvitsund.vgs.no",
        phone: "99240588",
        address: "Jacob Naadlands veg 2",
        postCode: "3850",
        postCity: "Kviteseid",
      })
    ).id;
  });

  test("stores the company as customer, the lines and a comment", async ({ assert }) => {
    const dueDate = new Date("2026-09-16T13:22:17.867Z");
    const created = await createCompanyInvoice({
      companyId,
      invoiceNumber: "20268005",
      reference: "Tove Fj. Johansen",
      ourReference: "Jørgen Rosenlund",
      dueDate,
      comment: "Bestillinger av 23.06.26 og 24.06.2026",
      lines: KVITSUND_LINES,
    });

    const invoice = (await Invoice.getOrFail(created.id)).toDto(null);
    assert.deepEqual(invoice, created);
    assert.equal(invoice.invoiceNumber, "20268005");
    assert.deepEqual(invoice.dueDate, dueDate);
    assert.isNull(invoice.type);
    assert.isNull(invoice.customerId);
    assert.isNull(invoice.branchId);
    assert.deepInclude(invoice, {
      customerName: "Kvitsund Gymnas",
      customerEmail: "bibliotek@kvitsund.vgs.no",
      customerPhone: "99240588",
      customerOrganizationNumber: "988982857",
      customerNumber: "988982857",
      customerAddress: "Jacob Naadlands veg 2",
      customerPostCity: "Kviteseid",
      customerPostCode: "3850",
      customerCountry: "norway",
      customerDob: null,
    });
    assert.lengthOf(invoice.lines, 4);
    assert.deepEqual(invoice.lines[0], {
      customerItemId: null,
      itemId: null,
      customerItemType: null,
      title: "Bios 1 2021",
      numberOfItems: 17,
      productNumber: 1,
      cancel: false,
      unit: 1249,
      gross: 8493.2,
      net: 8493.2,
      vat: 0,
      discount: 60,
    });
    assert.deepInclude(invoice, {
      totalGross: 17_365.7,
      totalNet: 17_365.7,
      totalVat: 0,
      totalDiscount: 220,
      totalIncludingFee: 17_365.7,
      feeUnit: null,
      feeGross: null,
    });
    assert.equal(invoice.comment, "Bestillinger av 23.06.26 og 24.06.2026");
    assert.isFalse(invoice.customerHasPaid);
  });

  test("keeps the company's details when the company changes", async ({ assert }) => {
    const created = await createCompanyInvoice({
      companyId,
      invoiceNumber: "20268006",
      reference: "",
      ourReference: "",
      dueDate: new Date(),
      lines: KVITSUND_LINES,
    });
    await Company.query().where("id", companyId).update({ name: "Nytt navn AS" });

    assert.equal((await Invoice.getOrFail(created.id)).customerName, "Kvitsund Gymnas");
    assert.isNull((await Invoice.getOrFail(created.id)).comment);
  });

  test("refuses an unknown company", async ({ assert }) => {
    await assert.rejects(
      () =>
        createCompanyInvoice({
          companyId: fixtureId("dead"),
          invoiceNumber: "1",
          reference: "",
          ourReference: "",
          dueDate: new Date(),
          lines: KVITSUND_LINES,
        }),
      /Selskapet finnes ikke/,
    );
    assert.lengthOf(await Invoice.all(), 0);
  });
});
