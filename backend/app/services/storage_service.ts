import type { ObjectId } from "mongodb";
import type { Schema } from "mongoose";

import { CustomerItemSchema } from "#models/mongoose/customer-item.schema";
import { DeliverySchema } from "#models/mongoose/delivery.schema";
import { InvoiceSchema } from "#models/mongoose/invoice.schema";
import { OrderSchema } from "#models/mongoose/order.schema";
import { PaymentSchema } from "#models/mongoose/payment.schema";
import { BlSchemaName } from "#models/mongoose/storage/bl-schema-names";
import { MongodbHandler } from "#models/mongoose/storage/mongodb-handler";

export type BlSchema<T> = Schema<ToSchema<T>>;

export const StorageService = {
  CustomerItems: new MongodbHandler(CustomerItemSchema, BlSchemaName.CustomerItems),
  Deliveries: new MongodbHandler(DeliverySchema, BlSchemaName.Deliveries),
  Invoices: new MongodbHandler(InvoiceSchema, BlSchemaName.Invoices),
  Orders: new MongodbHandler(OrderSchema, BlSchemaName.Orders),
  Payments: new MongodbHandler(PaymentSchema, BlSchemaName.Payments),
} as const;

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
