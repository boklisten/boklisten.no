import { Schema } from "mongoose";

import { BlSchema } from "#services/storage_service";
import { Message } from "#shared/message/message";

export const MessageSchema: BlSchema<Message> = new Schema({
  messageType: {
    type: String,
    required: true,
    enum: ["reminder", "custom-reminder", "generic", "receipt", "match", "booking"],
  },
  messageSubtype: {
    type: String,
    required: true,
    enum: ["partly-payment", "rent", "loan", "none", "confirmed", "canceled", "all"],
  },
  messageMethod: {
    type: String,
    required: true,
    // "all" is no longer written, but exists on historic documents
    enum: ["sms", "email", "all"],
  },
  sequenceNumber: {
    type: Number,
    default: 0,
  },
  customerId: {
    type: String,
    required: true,
  },
  employeeId: {
    type: String,
    required: false,
  },
  info: {
    type: Schema.Types.Mixed,
    required: false,
  },
  subject: {
    type: String,
    required: false,
  },
  htmlContent: {
    type: String,
    required: false,
  },
  events: [Schema.Types.Mixed],

  smsEvents: [Schema.Types.Mixed],
  textBlocks: [Schema.Types.Mixed],
});
