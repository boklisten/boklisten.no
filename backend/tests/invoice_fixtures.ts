import { DateTime } from "luxon";

import Invoice from "#models/invoice";
import type { NewInvoice, NewInvoiceLine } from "#models/invoice";
import type { Invoice as InvoiceDto, InvoiceLine as InvoiceLineDto } from "#shared/invoice";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

const PUPIL: Omit<NewInvoice, "lines"> = {
  invoiceNumber: "20268001",
  type: "rent",
  dueDate: DateTime.fromISO("2026-09-30"),
  branchId: null,
  customerId: null,
  customerNumber: "12345678",
  customerName: "Kari Nordmann",
  customerEmail: "kari@example.com",
  customerPhone: "91234567",
  customerDob: DateTime.fromISO("2008-04-28"),
  customerOrganizationNumber: null,
  customerAddress: "Testveien 1",
  customerPostCode: "0150",
  customerCountry: null,
  totalGross: 0,
  totalNet: 0,
  totalVat: 0,
  totalDiscount: 0,
  feeUnit: 0,
  feeGross: 0,
  feeNet: 0,
  feeVat: 0,
  feeDiscount: 0,
  totalIncludingFee: 0,
  reference: "Manglende levering av skolebøker",
  ourReference: null,
  comment: null,
};

const LINE: NewInvoiceLine = {
  customerItemId: null,
  itemId: null,
  customerItemType: "rent",
  title: "Bok",
  productNumber: null,
  numberOfItems: 1,
  unit: 0,
  gross: 0,
  net: 0,
  vat: 0,
  discount: 0,
};

/**
 * Inserts an invoice and its lines into the test Postgres: an unpaid pupil rent invoice with a
 * number of its own, without a customer or branch unless told otherwise. Referenced branches, customers, customer items and
 * items must exist already, since they are foreign keys. Pass only what the test cares about.
 */
export async function createInvoice(
  overrides: Partial<Omit<NewInvoice, "lines">> & { lines?: Partial<NewInvoiceLine>[] } = {},
): Promise<Invoice> {
  sequence++;
  const { lines = [], ...columns } = overrides;
  return Invoice.createWithLines({
    id: fixtureId(`1e${sequence.toString(16)}`),
    ...PUPIL,
    // Invoice numbers are unique.
    invoiceNumber: String(20_269_000 + sequence),
    ...columns,
    lines: lines.map(withLineDefaults),
  });
}

function withLineDefaults(line: Partial<NewInvoiceLine>): NewInvoiceLine {
  return { ...LINE, ...line };
}

/** A plain invoice line for pure functions. */
export function invoiceLineDto(overrides: Partial<InvoiceLineDto> = {}): InvoiceLineDto {
  return { ...LINE, cancelled: false, ...overrides };
}

/** A plain `Invoice` for pure functions, with the same defaults as {@link createInvoice}. */
export function invoiceDto(overrides: Partial<InvoiceDto> = {}): InvoiceDto {
  return {
    ...PUPIL,
    id: fixtureId("1e0"),
    dueDate: "2026-09-30",
    customerDob: "2008-04-28",
    status: "unpaid",
    branchName: null,
    createdAt: new Date("2026-09-16T10:00:00Z"),
    updatedAt: new Date("2026-09-16T10:00:00Z"),
    lines: [],
    ...overrides,
  };
}
