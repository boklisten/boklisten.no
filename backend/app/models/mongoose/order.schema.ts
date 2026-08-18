import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { BlSchema } from "#services/storage_service";
import { Order } from "#shared/order/order";

export const OrderSchema: BlSchema<Order> = new Schema({
  amount: {
    type: Number,
    required: true,
  },
  orderItems: {
    type: [
      {
        type: {
          // Important: keep this nesting ("type" is reserved by mongoose)
          type: String,
          required: true,
        },
        item: {
          type: Schema.Types.ObjectId,
          ref: BlSchemaName.Items,
          required: true,
        },
        blid: {
          type: String,
          trim: true,
        },
        title: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        unitPrice: {
          type: Number,
          required: true,
        },
        delivered: {
          type: Boolean,
          required: false,
          default: false,
        },
        customerItem: {
          type: Schema.Types.ObjectId,
          ref: BlSchemaName.CustomerItems,
          required: false,
        },
        info: {
          type: Schema.Types.Mixed,
          required: false,
        },
        handout: {
          type: Boolean,
          required: false,
        },
        movedFromOrder: {
          type: Schema.Types.ObjectId,
          ref: BlSchemaName.Orders,
          required: false,
        },
        movedToOrder: {
          type: Schema.Types.ObjectId,
          ref: BlSchemaName.Orders,
          required: false,
        },
      },
    ],
    default: [],
  },
  branch: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.Branches,
    required: true,
    index: true,
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.UserDetails,
    required: true,
  },
  byCustomer: {
    type: Boolean,
    required: true,
  },
  employee: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.UserDetails,
  },
  placed: {
    type: Boolean,
    default: false,
  },
  payments: {
    type: [String],
    default: [],
  },
  delivery: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.Deliveries,
  },
  handoutByDelivery: Boolean,
  notification: {
    email: Boolean,
  },
  checkoutState: String,
  kustomCheckoutId: String,
});
