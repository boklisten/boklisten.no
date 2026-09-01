import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import type { BlSchema } from "#services/storage_service";
import type { CustomerItem } from "#shared/customer-item/customer-item";

export const CustomerItemSchema: BlSchema<CustomerItem> = new Schema({
  item: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.Items,
    required: true,
  },
  type: {
    type: String,
    trim: true,
    lowercase: true,
    enum: ["rent", "partly-payment"],
    required: true,
  },
  blid: {
    type: String,
    trim: true,
    index: {
      name: "unique_active_blid",
      unique: true,
      partialFilterExpression: {
        blid: { $type: "string" },
        returned: false,
        buyout: false,
      },
    },
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.UserDetails,
    required: true,
  },
  deadline: {
    type: Date,
    required: true,
  },
  handout: {
    type: Boolean,
    default: false,
    required: true,
  },
  handoutInfo: {
    handoutBy: {
      type: String,
      enum: ["branch"],
      required: true,
    },
    handoutById: {
      type: Schema.Types.ObjectId,
      ref: BlSchemaName.Branches,
      required: true,
      index: true,
    },
    handoutEmployee: {
      type: Schema.Types.ObjectId,
      ref: BlSchemaName.UserDetails,
    },
    time: Date,
  },
  returned: {
    type: Boolean,
    required: true,
  },
  returnInfo: {
    returnedTo: {
      type: String,
      enum: ["branch"],
    },
    returnedToId: {
      type: Schema.Types.ObjectId,
      ref: BlSchemaName.Branches,
    },
    returnEmployee: {
      type: Schema.Types.ObjectId,
      ref: BlSchemaName.UserDetails,
    },
    time: Date,
  },
  cancel: {
    type: Boolean,
    default: false,
    required: true,
  },
  cancelInfo: {
    order: { type: Schema.Types.ObjectId, ref: BlSchemaName.Orders },
    time: Date,
  },
  buyout: {
    type: Boolean,
    default: false,
    required: true,
  },
  buyoutInfo: {
    order: { type: Schema.Types.ObjectId, ref: BlSchemaName.Orders },
    time: Date,
  },
  buyback: {
    type: Boolean,
    default: false,
    required: true,
  },
  buybackInfo: {
    order: { type: Schema.Types.ObjectId, ref: BlSchemaName.Orders },
  },

  orders: {
    type: [{ type: Schema.Types.ObjectId, ref: BlSchemaName.Orders }],
    default: [],
  },
  periodExtends: {
    type: [
      {
        from: {
          type: Date,
          required: true,
        },
        to: {
          type: Date,
          required: true,
        },
        periodType: {
          type: String,
          enum: ["semester", "year"],
          required: true,
        },
        time: {
          type: Date,
          required: true,
        },
      },
    ],
    default: [],
  },
  totalAmount: Number,
  amountLeftToPay: Number,
  customerInfo: {
    name: String,
    phone: String,
    address: String,
    postCode: String,
    postCity: String,
    dob: Date,
    guardian: {
      name: String,
      email: String,
      phone: String,
    },
  }, // fixme: this information should not be duped here, customer ref. instead, consider history of user details to retain user details history
});
