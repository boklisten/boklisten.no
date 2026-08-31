import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { BlSchema } from "#services/storage_service";
import { BranchItem } from "#shared/branch-item";

export const BranchItemSchema: BlSchema<BranchItem> = new Schema({
  branch: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.Branches,
    required: true,
    index: { name: "branch_item_unique", unique: true },
  },
  item: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.Items,
    required: true,
    index: { name: "branch_item_unique", unique: true },
  },

  rent: {
    type: Boolean,
    default: false,
  },
  partlyPayment: {
    type: Boolean,
    default: false,
  },
  buy: {
    type: Boolean,
    default: false,
  },
  sell: {
    type: Boolean,
    default: false,
  },
  live: {
    type: Boolean,
    default: false,
  },

  rentAtBranch: {
    type: Boolean,
    default: false,
  },
  partlyPaymentAtBranch: {
    type: Boolean,
    default: false,
  },
  buyAtBranch: {
    type: Boolean,
    default: false,
  },
  sellAtBranch: {
    type: Boolean,
    default: false,
  },
  liveAtBranch: {
    type: Boolean,
    default: false,
  },

  categories: {
    type: [String],
    default: [],
  },
});
