import { BaseSchema } from "@adonisjs/lucid/schema";
import mongoose from "mongoose";

import env from "#start/env";

/**
 * Message logging, replacing the long-dead Mongo `messages` collection (its webhook operations
 * looked up documents that nothing ever created, so no events were recorded for years).
 *
 * Messages are keyed by recipient (phone number or email address), not by customer: a customer's
 * log is resolved at read time from their *current* contact info, including guardian phone/email,
 * so updating contact info updates which history a customer sees, and siblings sharing a guardian
 * both see the guardian's messages. `regarding_customer_details_id` is display-only context
 * ("which child was this reminder about"), never used for querying and never migrated on merges.
 *
 * `sendouts` groups the rows of one bulk operation (a reminder run, a custom utsendelse, a match
 * notify round) so per-sendout delivery stats can be aggregated. Transactional one-offs (receipts,
 * password resets, ...) have no sendout.
 *
 * `message_events` is the append-only trail: one internal event per send attempt plus whatever
 * Twilio status callbacks and SendGrid event webhooks deliver. `provider_event_id` deduplicates
 * webhook retries (SendGrid retries on non-2xx; Twilio may re-POST) — SendGrid events carry a
 * unique `sg_event_id`, Twilio events synthesize `<MessageSid>:<MessageStatus>`.
 *
 * The old Mongo collection is dropped in the deferred block; its historic 2019–2023 reminder
 * documents are intentionally not migrated.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("sendouts", (table) => {
      table.increments("id");
      table.string("kind").notNullable();
      table.string("name").nullable();
      table.string("initiated_by_details_id", 24).nullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");
    });

    this.schema.createTable("messages", (table) => {
      table.uuid("id").primary();
      table
        .integer("sendout_id")
        .unsigned()
        .nullable()
        .references("sendouts.id")
        .onDelete("SET NULL");
      table.string("channel").notNullable();
      table.string("recipient").notNullable();
      table.string("message_type").notNullable();
      table.string("regarding_customer_details_id", 24).nullable();
      table.string("subject").nullable();
      table.text("sms_body").nullable();
      table.string("template_id").nullable();
      table.jsonb("template_data").nullable();
      table.string("provider_message_id").nullable();
      table.string("status").notNullable();
      table.string("status_detail").nullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");

      table.index(["recipient", "created_at"]);
      table.index(["sendout_id"]);
      table.index(["created_at"]);
      table.index(["status"]);
    });

    this.schema.createTable("message_events", (table) => {
      table.bigIncrements("id");
      table.uuid("message_id").notNullable().references("messages.id").onDelete("CASCADE");
      table.string("source").notNullable();
      table.string("event").notNullable();
      table.string("error_code").nullable();
      table.text("reason").nullable();
      table.jsonb("payload").nullable();
      table.string("provider_event_id").nullable().unique();
      table.timestamp("occurred_at").notNullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");

      table.index(["message_id", "occurred_at"]);
    });

    this.defer(async () => {
      if (env.get("API_ENV") === "test") {
        return;
      }

      const connection = await mongoose
        .createConnection(env.get("MONGODB_URI"), {
          dbName: env.get("API_ENV") === "production" ? "production" : "staging",
        })
        .asPromise();
      try {
        const mongo = connection.db;
        if (!mongo) {
          throw new Error("mongoose connection has no db handle");
        }
        await mongo.dropCollection("messages").catch((error: unknown) => {
          // NamespaceNotFound: already gone, nothing to drop.
          const alreadyGone =
            typeof error === "object" &&
            error !== null &&
            "codeName" in error &&
            error.codeName === "NamespaceNotFound";
          if (!alreadyGone) {
            throw error;
          }
        });
      } finally {
        await connection.close();
      }
    });
  }

  override async down() {
    this.schema.dropTable("message_events");
    this.schema.dropTable("messages");
    this.schema.dropTable("sendouts");
  }
}
