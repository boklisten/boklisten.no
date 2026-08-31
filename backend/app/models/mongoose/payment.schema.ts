import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { BlSchema } from "#services/storage_service";
import { Payment } from "#shared/payment/payment";

export const PaymentSchema: BlSchema<Payment> = new Schema({
  method: {
    type: String,
    required: true,
    // "dibs" is a retired payment gateway; kept for pre-2020 documents
    enum: ["card", "cash", "vipps", "vipps-checkout", "dibs"],
  },
  order: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.Orders,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.UserDetails,
    required: true,
  },
  branch: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.Branches,
    required: true,
  },
  info: Schema.Types.Mixed,
  confirmed: {
    type: Boolean,
    default: false,
  },
});
