import { Schema } from "mongoose";

import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import type { BlSchema } from "#services/storage_service";
import type { Login, User } from "#types/user";

const LoginSchema = new Schema<Login>(
  {
    vipps: {
      type: {
        userId: { type: String, required: true },
        lastLogin: { type: Date, required: true },
      },
      required: false,
      _id: false,
    },
    local: {
      type: {
        hashedPassword: { type: String, required: true },
        lastLogin: Date,
      },
      required: false,
      _id: false,
    },
    lastTokenIssuedAt: Date,
  },
  { _id: false },
);

export const UserSchema: BlSchema<User> = new Schema({
  userDetail: {
    type: Schema.Types.ObjectId,
    ref: BlSchemaName.UserDetails,
    index: {
      unique: true,
      name: "user_detail_unique",
    },
  },
  permission: {
    type: String,
    trim: true,
    lowercase: true,
    enum: ["customer", "employee", "manager", "admin"],
    required: true,
  },
  login: { type: LoginSchema, required: true },
});
