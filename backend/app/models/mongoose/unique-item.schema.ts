import { Schema } from "mongoose";

import type { BlSchema } from "#services/storage_service";
import type { UniqueItem } from "#shared/unique-item";

export const UniqueItemSchema: BlSchema<UniqueItem> = new Schema({
  blid: {
    type: String,
    trim: true,
    required: true,
    index: {
      unique: true,
      name: "blid_unique",
    },
  },
  item: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  title: {
    type: String,
    trim: true,
    required: true,
  },
});
