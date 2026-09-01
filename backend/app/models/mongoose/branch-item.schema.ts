import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import type { BlSchema } from "#services/storage_service";
import type { BranchItem } from "#shared/branch-item";

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
    required: true,
  },
  partlyPayment: {
    type: Boolean,
    default: false,
    required: true,
  },
  buy: {
    type: Boolean,
    default: false,
    required: true,
  },
  sell: {
    type: Boolean,
    default: false,
    required: true,
  },
  live: {
    type: Boolean,
    default: false,
    required: true,
  },

  rentAtBranch: {
    type: Boolean,
    default: false,
    required: true,
  },
  partlyPaymentAtBranch: {
    type: Boolean,
    default: false,
    required: true,
  },
  buyAtBranch: {
    type: Boolean,
    default: false,
    required: true,
  },
  sellAtBranch: {
    type: Boolean,
    default: false,
    required: true,
  },
  liveAtBranch: {
    type: Boolean,
    default: false,
    required: true,
  },

  categories: {
    type: [String],
    default: [],
  },
});
