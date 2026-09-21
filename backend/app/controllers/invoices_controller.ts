import type { HttpContext } from "@adonisjs/core/http";

import BadRequestException from "#exceptions/bad_request_exception";
import { createCompanyInvoice } from "#services/invoices/company_invoice_service";
import { generationDefaults } from "#services/invoices/invoice_defaults_service";
import { exportInvoices } from "#services/invoices/invoice_export_service";
import { generateInvoices } from "#services/invoices/invoice_generator_service";
import { getInvoice, listInvoices } from "#services/invoices/invoice_query_service";
import {
  deleteInvoice,
  setInvoiceLineCancelled,
  setInvoiceStatus,
  setInvoiceStatuses,
} from "#services/invoices/invoice_status_service";
import {
  companyInvoiceValidator,
  invoiceBulkStatusValidator,
  invoiceExportValidator,
  invoiceGenerationDefaultsValidator,
  invoiceGenerationValidator,
  invoiceLineCancelValidator,
  invoiceStatusValidator,
} from "#validators/invoices";

export default class InvoicesController {
  async index() {
    return listInvoices();
  }

  async show(ctx: HttpContext) {
    return getInvoice(ctx.request.param("invoiceId"));
  }

  async setStatus(ctx: HttpContext) {
    const { id: detailsId } = ctx.auth.getUserOrFail();
    const { status } = await ctx.request.validateUsing(invoiceStatusValidator);
    return setInvoiceStatus(ctx.request.param("invoiceId"), status, detailsId);
  }

  async setStatuses(ctx: HttpContext) {
    const { id: detailsId } = ctx.auth.getUserOrFail();
    const { invoiceIds, status } = await ctx.request.validateUsing(invoiceBulkStatusValidator);
    return setInvoiceStatuses(invoiceIds, status, detailsId);
  }

  async destroy(ctx: HttpContext) {
    await deleteInvoice(ctx.request.param("invoiceId"));
    return { deleted: true };
  }

  async setLineCancelled(ctx: HttpContext) {
    const { cancel } = await ctx.request.validateUsing(invoiceLineCancelValidator);
    const lineIndex = Number(ctx.request.param("lineIndex"));
    if (!Number.isInteger(lineIndex) || lineIndex < 0) {
      throw new BadRequestException("Fakturalinjen finnes ikke.");
    }
    return setInvoiceLineCancelled(ctx.request.param("invoiceId"), lineIndex, cancel);
  }

  async export(ctx: HttpContext) {
    const { invoiceIds, format } = await ctx.request.validateUsing(invoiceExportValidator);
    return exportInvoices(invoiceIds, format);
  }

  async generationDefaults(ctx: HttpContext) {
    const { type } = await ctx.request.validateUsing(invoiceGenerationDefaultsValidator);
    return generationDefaults(type);
  }

  async generate(ctx: HttpContext) {
    const { dryRun, deadlineFrom, deadlineTo, ...settings } = await ctx.request.validateUsing(
      invoiceGenerationValidator,
    );
    const from = new Date(deadlineFrom);
    const to = new Date(deadlineTo);
    if (from > to) {
      throw new BadRequestException("Fristen må starte før den slutter.");
    }
    return generateInvoices({ ...settings, deadlineFrom: from, deadlineTo: to }, dryRun);
  }

  async createCompanyInvoice(ctx: HttpContext) {
    const { duedate, ...input } = await ctx.request.validateUsing(companyInvoiceValidator);
    return createCompanyInvoice({ ...input, duedate: new Date(duedate) });
  }
}
