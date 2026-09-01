import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import type { BlSchema } from "#services/storage_service";
import type { Delivery } from "#shared/delivery/delivery";

// Shared shape for both methods: "branch" uses only { branch }, "bring" uses the rest.
// bl-admin's tracking-number flow also writes { branch, estimatedDelivery: null } on bring
// deliveries, and omits amount/taxAmount/product when the Bring API regeneration fails.
const deliveryInfoSchema = new Schema(
  {
    branch: String,
    amount: Number,
    taxAmount: Number,
    estimatedDelivery: Date,
    facilityAddress: {
      address: String,
      postalCode: String,
      postalCity: String,
    },
    shipmentAddress: {
      name: String,
      address: String,
      postalCode: String,
      postalCity: String,
    },
    from: String,
    to: String,
    product: String,
    trackingNumber: String,
  },
  { _id: false },
);

export const DeliverySchema: BlSchema<Delivery> = new Schema({
  method: {
    type: String,
    required: true,
    enum: ["branch", "bring"],
  },
  info: {
    type: deliveryInfoSchema,
    required: true,
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
});
