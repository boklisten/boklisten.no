import { Schema } from "mongoose";

import type { BlSchema } from "#services/storage_service";
import type { Payment } from "#shared/payment/payment";

export const PaymentSchema: BlSchema<Payment> = new Schema({
  method: {
    type: String,
    required: true,
    // "dibs" is a retired payment gateway; kept for pre-2020 documents
    enum: ["card", "cash", "vipps", "vipps-checkout", "vipps-epayment", "bank-transfer", "dibs"],
  },
  order: {
    type: Schema.Types.ObjectId,
    required: true,
    // The order's payments are found through this field (orders live in Postgres).
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  customer: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  branch: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  info: Schema.Types.Mixed,
  confirmed: {
    type: Boolean,
    default: false,
  },
});
