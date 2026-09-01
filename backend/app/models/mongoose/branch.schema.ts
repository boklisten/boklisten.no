import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import type { BlSchema } from "#services/storage_service";
import type { Branch } from "#shared/branch";

export const BranchSchema: BlSchema<Branch> = new Schema({
  name: {
    type: String,
    trim: true,
    required: true,
  },
  logo: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    trim: true,
    enum: ["VGS", "privatist", null],
  },
  parentBranch: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.Branches,
  },
  localName: String,
  childBranches: [
    {
      type: Schema.Types.ObjectId,
      ref: BlSchemaName.Branches,
    },
  ],
  childLabel: String,
  paymentInfo: {
    responsible: {
      type: Boolean,
      default: false,
      required: true,
    },
    responsibleForDelivery: Boolean,
    partlyPaymentPeriods: {
      type: [
        {
          type: {
            // Important: keep this nesting ("type" is reserved by mongoose)
            type: String,
            enum: ["semester", "year"],
          },
          date: Date,
          percentageBuyout: Number,
          percentageBuyoutUsed: Number,
          percentageUpFront: Number,
          percentageUpFrontUsed: Number,
        },
      ],
      default: [],
    },
    rentPeriods: {
      type: [
        {
          type: {
            // Important: keep this nesting ("type" is reserved by mongoose)
            type: String,
            enum: ["semester", "year"],
          },
          maxNumberOfPeriods: Number,
          date: Date,
          percentage: Number,
        },
      ],
      default: [],
    },
    extendPeriods: {
      type: [
        {
          type: {
            // Important: keep this nesting ("type" is reserved by mongoose)
            type: String,
            enum: ["semester", "year"],
          },
          maxNumberOfPeriods: Number,
          date: Date,
          percentage: Number,
          price: Number,
        },
      ],
      default: [],
    },
    buyout: {
      percentage: {
        type: Number,
        default: 1,
      },
    },
    sell: {
      percentage: {
        type: Number,
        default: 1,
      },
    },
  },
  deliveryMethods: {
    branch: {
      type: Boolean,
      default: true,
    },
    byMail: {
      type: Boolean,
      default: true,
    },
  },
  isBranchItemsLive: {
    online: Boolean,
    atBranch: Boolean,
  },
  branchItems: [{ type: Schema.Types.ObjectId, ref: BlSchemaName.BranchItems }],
  location: {
    type: {
      region: { type: String, trim: true, required: true },
      address: { type: String, trim: true },
    },
    required: true,
  },
});
