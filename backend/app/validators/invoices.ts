import vine from "@vinejs/vine";

import { dateStringField, objectIdField } from "#validators/common/fields";
import {
  GENERATABLE_INVOICE_TYPES,
  INVOICE_EXPORT_FORMATS,
  INVOICE_STATUSES,
} from "#shared/invoice";

export const invoiceBatchQueryValidator = vine.create(
  vine.object({
    batch: vine.string().regex(/^\d{5}$/),
  }),
);

export const invoiceStatusValidator = vine.create(
  vine.object({
    status: vine.enum(INVOICE_STATUSES),
  }),
);

export const invoiceBulkStatusValidator = vine.create(
  vine.object({
    invoiceIds: vine.array(objectIdField.clone()).minLength(1),
    status: vine.enum(INVOICE_STATUSES),
  }),
);

export const invoiceLineCancelValidator = vine.create(
  vine.object({
    cancel: vine.boolean(),
  }),
);

export const invoiceExportValidator = vine.create(
  vine.object({
    invoiceIds: vine.array(objectIdField.clone()).minLength(1),
    format: vine.enum(INVOICE_EXPORT_FORMATS),
  }),
);

export const invoiceGenerationValidator = vine.create(
  vine.object({
    type: vine.enum(GENERATABLE_INVOICE_TYPES),
    deadlineFrom: dateStringField.clone(),
    deadlineTo: dateStringField.clone(),
    invoiceNumber: vine.number().withoutDecimals().positive(),
    fee: vine.number().min(0),
    feeVatPercentage: vine.number().min(0).max(1),
    feePercentage: vine.number().min(0),
    daysToDeadline: vine.number().withoutDecimals().min(0),
    reference: vine.string().trim(),
    dryRun: vine.boolean(),
  }),
);

export const invoiceGenerationDefaultsValidator = vine.create(
  vine.object({
    type: vine.enum(GENERATABLE_INVOICE_TYPES),
  }),
);

export const companyInvoiceValidator = vine.create(
  vine.object({
    companyId: objectIdField.clone(),
    invoiceNumber: vine.string().trim().minLength(1),
    reference: vine.string().trim(),
    ourReference: vine.string().trim(),
    duedate: dateStringField.clone(),
    comment: vine.string().trim().optional(),
    lines: vine
      .array(
        vine.object({
          title: vine.string().trim().minLength(1),
          productNumber: vine.number().withoutDecimals().min(0),
          price: vine.number().min(0),
          numberOfUnits: vine.number().positive(),
          discount: vine.number().min(0).max(100),
          taxPercentage: vine.number().min(0).max(100),
        }),
      )
      .minLength(1),
  }),
);
