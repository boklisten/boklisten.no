import { test } from "@japa/runner";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { CustomerInvoiceActive } from "#services/legacy/collections/invoice/helpers/customer-invoice-active";
import { StorageService } from "#services/storage_service";
import { BlError } from "#shared/bl-error";
import type { Invoice } from "#shared/invoice";

test.group("CustomerInvoiceActive", (group) => {
  const customerInvoiceActive = new CustomerInvoiceActive();
  const testUserId = "5f2aa6e8d39045001c444842";
  let sandbox: sinon.SinonSandbox;
  let getInvoicesByQueryStub: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    getInvoicesByQueryStub = sandbox.stub(StorageService.Invoices, "getByQuery");
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should return false if no invoices was found for customer", async ({ assert }) => {
    getInvoicesByQueryStub.rejects(new BlError("not found").code(702));

    assert.isFalse(await customerInvoiceActive.haveActiveInvoices(testUserId));
  });

  test("should return false if invoices was found but none was active", async ({ assert }) => {
    const inactiveInvoice: Invoice = {
      id: "invoice1",
      duedate: new Date(),
      customerHavePayed: true,
      toDebtCollection: false,
      toCreditNote: false,
      customerItemPayments: [],

      // @ts-expect-error fixme: auto ignored
      customerInfo: null,

      // @ts-expect-error fixme: auto ignored
      payment: null,
    };

    const inactiveInvoice2: Invoice = {
      id: "invoice2",
      duedate: new Date(),
      customerHavePayed: false,
      toDebtCollection: false,
      toCreditNote: true,
      customerItemPayments: [],

      // @ts-expect-error fixme: auto ignored
      customerInfo: null,

      // @ts-expect-error fixme: auto ignored
      payment: null,
    };

    getInvoicesByQueryStub.resolves([inactiveInvoice, inactiveInvoice2]);

    assert.isFalse(await customerInvoiceActive.haveActiveInvoices(testUserId));
  });

  test("should return true if invoices was found and at least one was active", async ({
    assert,
  }) => {
    const inactiveInvoice: Invoice = {
      id: "invoice1",
      duedate: new Date(),
      customerHavePayed: true,
      toDebtCollection: false,
      toCreditNote: false,
      customerItemPayments: [],

      // @ts-expect-error fixme: auto ignored
      customerInfo: null,

      // @ts-expect-error fixme: auto ignored
      payment: null,
    };

    const inactiveInvoice2: Invoice = {
      id: "invoice2",
      duedate: new Date(),
      customerHavePayed: false,
      toDebtCollection: false,
      toCreditNote: false,
      customerItemPayments: [],

      // @ts-expect-error fixme: auto ignored
      customerInfo: null,

      // @ts-expect-error fixme: auto ignored
      payment: null,
    };

    getInvoicesByQueryStub.resolves([inactiveInvoice, inactiveInvoice2]);

    assert.isTrue(await customerInvoiceActive.haveActiveInvoices(testUserId));
  });
});
