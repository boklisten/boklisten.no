import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Passwords are gone: login is Vipps or a one-time SMS code. `sms_codes` holds the hashed codes,
 * one live code per target, and a user with Vipps linked may turn SMS login off.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("sms_codes", (table) => {
      table.increments("id");
      table.text("phone").notNullable();
      table.text("purpose").notNullable();
      // Set for a phone change: the code proves the number to that user only.
      table.string("user_id", 24).nullable().references("id").inTable("users").onDelete("CASCADE");
      table.text("code_hash").notNullable();
      table.integer("attempts").notNullable().defaultTo(0);
      table.timestamp("expires_at").notNullable();
      table.timestamp("created_at").notNullable().defaultTo(this.now());
    });
    this.schema.raw(
      `CREATE UNIQUE INDEX "sms_codes_target_unique" ON "sms_codes" ("phone", "purpose", "user_id") NULLS NOT DISTINCT`,
    );
    this.schema.raw(
      `CREATE INDEX "sms_codes_user_id_index" ON "sms_codes" ("user_id") WHERE "user_id" IS NOT NULL`,
    );
    this.schema.raw(
      `ALTER TABLE sms_codes ADD CONSTRAINT sms_codes_phone_check CHECK (phone ~ '^[0-9]{8}$')`,
    );
    this.schema.raw(
      `ALTER TABLE sms_codes ADD CONSTRAINT sms_codes_purpose_check
       CHECK (purpose IN ('login', 'phone-change'))`,
    );

    this.schema.dropTable("password_resets");
    this.schema.alterTable("users", (table) => {
      table.dropColumn("local_hashed_password");
      table.boolean("sms_login_enabled").notNullable().defaultTo(true);
    });
  }

  override async down() {
    this.schema.alterTable("users", (table) => {
      table.dropColumn("sms_login_enabled");
      table.text("local_hashed_password").nullable();
    });
    this.schema.createTable("password_resets", (table) => {
      table.increments("id");
      table.text("token_hash").notNullable();
      table
        .string("user_id", 24)
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE")
        .index();
      table.timestamp("created_at").notNullable().defaultTo(this.now());
      table.timestamp("updated_at").notNullable().defaultTo(this.now());
    });
    this.schema.dropTable("sms_codes");
  }
}
