import { test } from "@japa/runner";

import { InvoiceActive } from "#services/legacy/collections/invoice/helpers/invoice-active";
import type { Invoice } from "#shared/invoice";

test.group("InvoiceActive", async () => {
  const invoiceActive = new InvoiceActive();

  test("should return false if invoice is not active", async ({ assert }) => {
    const nonActiveInvoices: Invoice[] = [
      {
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
      },
      {
        id: "invoice1",
        duedate: new Date(),
        customerHavePayed: false,
        toDebtCollection: false,
        toCreditNote: true,
        customerItemPayments: [],

        // @ts-expect-error fixme: auto ignored
        customerInfo: null,

        // @ts-expect-error fixme: auto ignored
        payment: null,
      },
    ];

    for (const invoice of nonActiveInvoices) {
      // oxlint-disable-next-line no-unused-expressions
      assert.isFalse(invoiceActive.isActive(invoice));
    }
  });

  test("should return true if invoice is active", async ({ assert }) => {
    const activeInvoices: Invoice[] = [
      {
        id: "invoice1",
        duedate: new Date(),
        customerHavePayed: false,
        toDebtCollection: false,
        toCreditNote: false,
        customerItemPayments: [],

        // @ts-expect-error fixme: auto ignored
        customerInfo: null,

        // @ts-expect-error fixme: auto ignored
        payment: null,
      },
      {
        id: "invoice1",
        duedate: new Date(),
        customerHavePayed: false,
        toDebtCollection: true,
        toCreditNote: false,
        customerItemPayments: [],

        // @ts-expect-error fixme: auto ignored
        customerInfo: null,

        // @ts-expect-error fixme: auto ignored
        payment: null,
      },
    ];

    for (const invoice of activeInvoices) {
      // oxlint-disable-next-line no-unused-expressions
      assert.isTrue(invoiceActive.isActive(invoice));
    }
  });
});
