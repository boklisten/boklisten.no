import type { HttpContext } from "@adonisjs/core/http";

import BadRequestException from "#exceptions/bad_request_exception";
import { createCompanyInvoice } from "#services/invoices/company_invoice_service";
import { generationDefaults } from "#services/invoices/invoice_defaults_service";
import { exportInvoices } from "#services/invoices/invoice_export_service";
import { generateInvoices } from "#services/invoices/invoice_generator_service";
import {
  getInvoice,
  listInvoiceBatches,
  listInvoicesInBatch,
} from "#services/invoices/invoice_query_service";
import {
  setInvoiceLineCancelled,
  setInvoiceStatus,
} from "#services/invoices/invoice_status_service";
import { PermissionService } from "#services/permission_service";
import {
  companyInvoiceValidator,
  invoiceBatchQueryValidator,
  invoiceExportValidator,
  invoiceGenerationDefaultsValidator,
  invoiceGenerationValidator,
  invoiceLineCancelValidator,
  invoiceStatusValidator,
} from "#validators/invoices";

export default class InvoicesController {
  async batches(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return listInvoiceBatches();
  }

  async list(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { batch } = await ctx.request.validateUsing(invoiceBatchQueryValidator);
    return listInvoicesInBatch(batch);
  }

  async get(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    return getInvoice(ctx.request.param("invoiceId"));
  }

  async setStatus(ctx: HttpContext) {
    const { detailsId } = PermissionService.adminOrFail(ctx);
    const { status } = await ctx.request.validateUsing(invoiceStatusValidator);
    return setInvoiceStatus(ctx.request.param("invoiceId"), status, detailsId);
  }

  async setLineCancelled(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { cancel } = await ctx.request.validateUsing(invoiceLineCancelValidator);
    const lineIndex = Number(ctx.request.param("lineIndex"));
    if (!Number.isInteger(lineIndex) || lineIndex < 0) {
      throw new BadRequestException("Fakturalinjen finnes ikke.");
    }
    return setInvoiceLineCancelled(ctx.request.param("invoiceId"), lineIndex, cancel);
  }

  async export(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { invoiceIds, format } = await ctx.request.validateUsing(invoiceExportValidator);
    return exportInvoices(invoiceIds, format);
  }

  async generationDefaults(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
    const { type } = await ctx.request.validateUsing(invoiceGenerationDefaultsValidator);
    return generationDefaults(type);
  }

  async generate(ctx: HttpContext) {
    PermissionService.adminOrFail(ctx);
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
    PermissionService.adminOrFail(ctx);
    const { duedate, ...input } = await ctx.request.validateUsing(companyInvoiceValidator);
    return createCompanyInvoice({ ...input, duedate: new Date(duedate) });
  }
}
