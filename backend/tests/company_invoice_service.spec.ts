import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import {
  companyInvoiceTotal,
  createCompanyInvoice,
} from "#services/invoices/company_invoice_service";
import { StorageService } from "#services/storage_service";
import type { Company } from "#shared/company";
import { companyLinePayment } from "#shared/invoice";
import type { CompanyInvoiceLine } from "#shared/invoice";
import { mock } from "#tests/test-doubles";

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
  test("a line is priced as bl-admin did: units times discounted price, two decimals", ({
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
  let sandbox: sinon.SinonSandbox;
  let addInvoice: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox.stub(StorageService, "Companies").value({
      getOrNull: sandbox.stub().resolves(
        mock<Company>({
          id: "company1",
          name: "Kvitsund Gymnas",
          organizationNumber: "988982857",
          customerNumber: "988982857",
          contactInfo: {
            email: "bibliotek@kvitsund.vgs.no",
            phone: "99240588",
            address: "Jacob Naadlands veg 2",
            postCode: "3850",
            postCity: "Kviteseid",
          },
        }),
      ),
    });
    addInvoice = sandbox
      .stub()
      .callsFake((invoice) => Promise.resolve({ ...invoice, id: "saved" }));
    sandbox.stub(StorageService, "Invoices").value({ add: addInvoice });
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("stores the company as customer, the lines and a comment", async ({ assert }) => {
    const duedate = new Date("2026-09-16T13:22:17.867Z");
    await createCompanyInvoice({
      companyId: "company1",
      invoiceNumber: "20268005",
      reference: "Tove Fj. Johansen",
      ourReference: "Jørgen Rosenlund",
      duedate,
      comment: "Bestillinger av 23.06.26 og 24.06.2026",
      lines: KVITSUND_LINES,
    });

    const [invoice] = addInvoice.firstCall.args;
    assert.equal(invoice.invoiceId, "20268005");
    assert.equal(invoice.duedate, duedate);
    assert.deepEqual(invoice.customerInfo, {
      name: "Kvitsund Gymnas",
      email: "bibliotek@kvitsund.vgs.no",
      phone: "99240588",
      organizationNumber: "988982857",
      customerNumber: "988982857",
      postal: {
        address: "Jacob Naadlands veg 2",
        city: "Kviteseid",
        code: "3850",
        country: "norway",
      },
    });
    assert.deepEqual(invoice.customerItemPayments[0], {
      title: "Bios 1 2021",
      numberOfItems: 17,
      productNumber: 1,
      payment: { unit: 1249, gross: 8493.2, net: 8493.2, vat: 0, discount: 60 },
    });
    assert.deepEqual(invoice.payment, {
      total: { gross: 17_365.7, net: 17_365.7, vat: 0, discount: 220 },
      totalIncludingFee: 17_365.7,
    });
    assert.equal(invoice.comments[0].msg, "Bestillinger av 23.06.26 og 24.06.2026");
    assert.isFalse(invoice.customerHavePayed);
  });

  test("refuses an unknown company", async ({ assert }) => {
    sandbox.stub(StorageService, "Companies").value({ getOrNull: sandbox.stub().resolves(null) });

    await assert.rejects(
      () =>
        createCompanyInvoice({
          companyId: "nope",
          invoiceNumber: "1",
          reference: "",
          ourReference: "",
          duedate: new Date(),
          lines: KVITSUND_LINES,
        }),
      /Selskapet finnes ikke/,
    );
    assert.isTrue(addInvoice.notCalled);
  });
});
