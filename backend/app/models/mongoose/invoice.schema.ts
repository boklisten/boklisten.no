import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import type { BlSchema } from "#services/storage_service";
import type { Invoice } from "#shared/invoice";

export const InvoiceSchema: BlSchema<Invoice> = new Schema({
  duedate: {
    type: Date,
    required: true,
  },
  customerHavePayed: {
    type: Boolean,
    default: false,
    required: true,
  },
  branch: { type: Schema.Types.ObjectId, ref: BlSchemaName.Branches },
  toCreditNote: {
    type: Boolean,
    default: false,
    required: true,
  },
  type: {
    type: String,
  },
  toDebtCollection: {
    type: Boolean,
    default: false,
    required: true,
  },
  toLossNote: {
    type: Boolean,
    default: false,
    required: true,
  },
  customerItemPayments: {
    type: [
      {
        customerItem: {
          type: Schema.Types.ObjectId,
          ref: BlSchemaName.CustomerItems,
        },
        title: String,
        item: { type: Schema.Types.ObjectId, ref: BlSchemaName.Items },
        numberOfItems: String,
        customerNumber: String,
        cancel: Boolean,
        customerItemType: String,
        organizationNumber: String,
        productNumber: String,
        payment: {
          unit: Number,
          gross: Number,
          net: Number,
          vat: Number,
          discount: Number,
        },
      },
    ],
    default: [],
  },
  customerInfo: {
    type: {
      userDetail: String,
      companyDetail: String,
      customerNumber: String,
      name: String,
      email: String,
      branchName: String,
      organizationNumber: String,
      phone: String,
      dob: String,
      postal: {
        address: String,
        city: String,
        code: String,
        country: String,
      },
    },
  },
  payment: {
    type: {
      total: {
        gross: Number,
        net: Number,
        vat: Number,
        discount: Number,
      },
      fee: {
        unit: Number,
        gross: Number,
        net: Number,
        vat: Number,
        discount: Number,
      },
      totalIncludingFee: Number,
    },
    required: true,
  },
  ourReference: String,
  invoiceId: String,
  reference: String,
  comments: {
    type: [
      {
        id: String,
        msg: String,
        creationTime: {
          type: Date,
          default: Date.now(),
        },
        user: {
          type: Schema.Types.ObjectId,
          ref: BlSchemaName.UserDetails,
        },
      },
    ],
  },
});
