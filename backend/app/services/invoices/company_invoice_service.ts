import BadRequestException from "#exceptions/bad_request_exception";
import { StorageService } from "#services/storage_service";
import { companyLinePayment } from "#shared/invoice";
import type { CompanyInvoiceInput, CompanyInvoiceLine, Invoice } from "#shared/invoice";

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
    // bl-admin summed the line discounts here, so this is not a percentage of the total.
    discount: payments.reduce((sum, payment) => sum + payment.discount, 0),
  };
}

export async function createCompanyInvoice(input: CompanyInvoiceInput): Promise<Invoice> {
  const invoice: Omit<Invoice, "id"> = await buildCompanyInvoice(input);
  return StorageService.Invoices.add(invoice);
}

async function buildCompanyInvoice(input: CompanyInvoiceInput): Promise<Omit<Invoice, "id">> {
  const company = await StorageService.Companies.getOrNull(input.companyId);
  if (!company) {
    throw new BadRequestException("Selskapet finnes ikke.");
  }
  const total = companyInvoiceTotal(input.lines);
  return {
    invoiceId: input.invoiceNumber,
    reference: input.reference,
    ourReference: input.ourReference,
    duedate: input.duedate,
    customerHavePayed: false,
    toCreditNote: false,
    toDebtCollection: false,
    toLossNote: false,
    customerItemPayments: input.lines.map((line) => ({
      title: line.title,
      numberOfItems: line.numberOfUnits,
      productNumber: line.productNumber,
      payment: companyLinePayment(line),
    })),
    customerInfo: {
      name: company.name,
      email: company.contactInfo.email,
      phone: company.contactInfo.phone,
      organizationNumber: company.organizationNumber,
      customerNumber: company.customerNumber,
      postal: {
        address: company.contactInfo.address,
        city: company.contactInfo.postCity,
        code: company.contactInfo.postCode,
        country: "norway",
      },
    },
    payment: { total, totalIncludingFee: total.gross },
    comments: input.comment ? [{ msg: input.comment, creationTime: new Date() }] : [],
  };
}
