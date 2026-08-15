import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { BlSchema } from "#services/storage_service";
import { CustomerItem } from "#shared/customer-item/customer-item";

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
    enum: ["rent", "partly-payment", null],
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
    returnedTo: String,
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
  },
  cancelInfo: {
    order: { type: Schema.Types.ObjectId, ref: BlSchemaName.Orders },
    time: Date,
  },
  buyout: {
    type: Boolean,
    default: false,
  },
  buyoutInfo: {
    order: { type: Schema.Types.ObjectId, ref: BlSchemaName.Orders },
    time: Date,
  },
  buyback: {
    type: Boolean,
    default: false,
  },
  buybackInfo: {
    order: { type: Schema.Types.ObjectId, ref: BlSchemaName.Orders },
  },

  orders: [{ type: Schema.Types.ObjectId, ref: BlSchemaName.Orders }],
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
