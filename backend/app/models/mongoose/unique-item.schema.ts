import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
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
    ref: BlSchemaName.Items,
    required: true,
  },
  title: {
    type: String,
    trim: true,
    required: true,
  },
});
