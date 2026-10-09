import { DateTime } from "luxon";

import BadRequestException from "#exceptions/bad_request_exception";
import Company from "#models/company";
import Invoice from "#models/invoice";
import type { NewInvoice } from "#models/invoice";
import { companyLinePayment } from "#shared/invoice";
import type {
  CompanyInvoiceInput,
  CompanyInvoiceLine,
  Invoice as InvoiceDto,
} from "#shared/invoice";

/**
 * Invoices to companies (schools buying books outright) are written by hand: a company, a
 * number, references and a list of lines.
 */

export function companyInvoiceTotal(lines: CompanyInvoiceLine[]) {
  const payments = lines.map((line) => companyLinePayment(line));
  return {
    gross: payments.reduce((sum, payment) => sum + payment.gross, 0),
    net: payments.reduce((sum, payment) => sum + payment.net, 0),
    vat: payments.reduce((sum, payment) => sum + payment.vat, 0),
    // Legacy bl-admin summed the line discounts here, so this is not a percentage of the total.
    discount: payments.reduce((sum, payment) => sum + payment.discount, 0),
  };
}

export async function createCompanyInvoice(input: CompanyInvoiceInput): Promise<InvoiceDto> {
  const invoice = await Invoice.createWithLines(await buildCompanyInvoice(input));
  return invoice.toDto(null);
}

async function buildCompanyInvoice(input: CompanyInvoiceInput): Promise<NewInvoice> {
  const company = await Company.find(input.companyId);
  if (!company) {
    throw new BadRequestException("Selskapet finnes ikke.");
  }
  const total = companyInvoiceTotal(input.lines);
  return {
    invoiceNumber: input.invoiceNumber,
    type: null,
    reference: input.reference,
    ourReference: input.ourReference,
    dueDate: DateTime.fromISO(input.dueDate),
    branchId: null,
    customerId: null,
    customerNumber: company.customerNumber,
    customerName: company.name,
    customerEmail: company.email,
    customerPhone: company.phone,
    customerDob: null,
    customerOrganizationNumber: company.organizationNumber,
    customerAddress: company.address,
    customerPostCode: company.postCode,
    customerCountry: "norway",
    totalGross: total.gross,
    totalNet: total.net,
    totalVat: total.vat,
    totalDiscount: total.discount,
    feeUnit: null,
    feeGross: null,
    feeNet: null,
    feeVat: null,
    feeDiscount: null,
    totalIncludingFee: total.gross,
    comment: input.comment ?? null,
    lines: input.lines.map((line) => ({
      customerItemId: null,
      itemId: null,
      customerItemType: null,
      title: line.title,
      productNumber: line.productNumber,
      numberOfItems: line.numberOfUnits,
      ...companyLinePayment(line),
    })),
  };
}
