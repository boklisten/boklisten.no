import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import type { BlSchema } from "#services/storage_service";
import type { UserDetail } from "#shared/user-detail";

export const UserDetailSchema: BlSchema<UserDetail> = new Schema({
  name: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    required: true,
    index: {
      unique: true,
      name: "email_unique",
    },
  },
  phone: {
    type: String,
    trim: true,
    index: {
      unique: true,
      sparse: true,
      name: "phone_unique",
    },
  },
  address: {
    type: String,
    trim: true,
  },
  postCode: {
    type: String,
    trim: true,
  },
  postCity: {
    type: String,
    trim: true,
  },
  emailConfirmed: {
    type: Boolean,
    default: false,
    required: true,
  },
  dob: {
    type: Date,
  },
  guardian: {
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    emailConfirmed: {
      type: Boolean,
    },
    phone: {
      type: String,
      trim: true,
    },
    confirmed: {
      type: Boolean,
    },
  },
  customerItems: [{ type: Schema.Types.ObjectId, ref: BlSchemaName.CustomerItems }],
  orders: [{ type: Schema.Types.ObjectId, ref: BlSchemaName.Orders }],
  blid: {
    type: String,
    required: true,
  },
  branchMembership: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.Branches,
  },
  tasks: {
    confirmDetails: Boolean,
    signAgreement: Boolean,
  },
});
