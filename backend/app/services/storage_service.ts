import { ObjectId } from "mongodb";
import { Schema } from "mongoose";

import { BranchItemSchema } from "#models/mongoose/branch-item.schema";
import { BranchSchema } from "#models/mongoose/branch.schema";
import { CompanySchema } from "#models/mongoose/company.schema";
import { CustomerItemSchema } from "#models/mongoose/customer-item.schema";
import { DeliverySchema } from "#models/mongoose/delivery.schema";
import { InvoiceSchema } from "#models/mongoose/invoice.schema";
import { ItemSchema } from "#models/mongoose/item.schema";
import { MessageSchema } from "#models/mongoose/message.schema";
import { OrderSchema } from "#models/mongoose/order.schema";
import { PaymentSchema } from "#models/mongoose/payment.schema";
import { SignatureSchema } from "#models/mongoose/signature.schema";
import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { MongodbHandler } from "#models/mongoose/storage/mongodb-handler";
import { UniqueItemSchema } from "#models/mongoose/unique-item.schema";
import { UserDetailSchema } from "#models/mongoose/user-detail.schema";
import { UserSchema } from "#models/mongoose/user.schema";

export type BlSchema<T> = Schema<ToSchema<T>>;

export const StorageService = {
  Branches: new MongodbHandler(BranchSchema, BlSchemaName.Branches),
  BranchItems: new MongodbHandler(BranchItemSchema, BlSchemaName.BranchItems),
  Companies: new MongodbHandler(CompanySchema, BlSchemaName.Companies),
  CustomerItems: new MongodbHandler(CustomerItemSchema, BlSchemaName.CustomerItems),
  Deliveries: new MongodbHandler(DeliverySchema, BlSchemaName.Deliveries),
  Invoices: new MongodbHandler(InvoiceSchema, BlSchemaName.Invoices),
  Items: new MongodbHandler(ItemSchema, BlSchemaName.Items),
  Messages: new MongodbHandler(MessageSchema, BlSchemaName.Messages),
  Orders: new MongodbHandler(OrderSchema, BlSchemaName.Orders),
  Payments: new MongodbHandler(PaymentSchema, BlSchemaName.Payments),
  Signatures: new MongodbHandler(SignatureSchema, BlSchemaName.Signatures),
  UniqueItems: new MongodbHandler(UniqueItemSchema, BlSchemaName.UniqueItems),
  Users: new MongodbHandler(UserSchema, BlSchemaName.Users),
  UserDetails: new MongodbHandler(UserDetailSchema, BlSchemaName.UserDetails),
} as const;

export type BlStorageHandler = (typeof StorageService)[keyof typeof StorageService];

type BlModelTypes = {
  [K in keyof typeof StorageService]: (typeof StorageService)[K] extends MongodbHandler<infer T>
    ? T
    : never;
}[keyof typeof StorageService];

export type BlStorageData =
  | {
      [K in keyof typeof StorageService]: (typeof StorageService)[K] extends MongodbHandler<infer T>
        ? T[]
        : never;
    }[keyof typeof StorageService]
  | BlModelTypes[];

// Re-format BlDocument type to one fitting for mongoose schemas
// Recursively union string-fields with ObjectId (e.g. {b: string} => {b: string | ObjectId}), except if the field is
// named "type" (because that's reserved and errors)
type ToSchema<T> = {
  [key in keyof T]: T[key] extends string
    ? key extends "type"
      ? T[key]
      : T[key] | ObjectId
    : T[key] extends "boolean" | "number"
      ? T[key]
      : ToSchema<T[key]>;
};
