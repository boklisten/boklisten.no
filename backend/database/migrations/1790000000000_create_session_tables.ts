import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Logins move from JWTs in localStorage to HTTP sessions (`@adonisjs/session` database store)
 * with remember-me tokens (`@adonisjs/auth` session guard). `users.blid`, the random `sub` of the
 * old tokens, goes with them, and the three per-method login stamps collapse into one
 * `last_active_at`, which every login and, coarsely, every authenticated request refreshes.
 */
export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("sessions", (table) => {
      table.string("id").primary();
      table.text("data").notNullable();
      // Tagged with the logged-in user so all of their sessions can be ended at once; a deleted
      // user takes their sessions with them.
      table
        .string("user_id", 24)
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE")
        .index();
      table.timestamp("expires_at").notNullable().index();
    });

    this.schema.createTable("remember_me_tokens", (table) => {
      table.increments("id");
      table
        .string("tokenable_id", 24)
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE")
        .index();
      table.string("hash").notNullable().unique();
      table.timestamp("created_at").notNullable();
      table.timestamp("updated_at").notNullable();
      table.timestamp("expires_at").notNullable();
    });

    this.schema.alterTable("users", (table) => {
      table.dropColumn("blid");
      table.timestamp("last_active_at").nullable();
    });
    // The legacy app stamped each login method and every token refresh separately; the newest
    // of them is when the user was last seen.
    this.defer(async (db) => {
      await db.rawQuery(
        `UPDATE users
         SET last_active_at = GREATEST(local_last_login, vipps_last_login, last_token_issued_at)`,
      );
    });
    this.schema.alterTable("users", (table) => {
      table.dropColumns("local_last_login", "vipps_last_login", "last_token_issued_at");
    });
  }

  override async down() {
    this.schema.alterTable("users", (table) => {
      table.text("blid").nullable();
      table.timestamp("local_last_login").nullable();
      table.timestamp("vipps_last_login").nullable();
      table.timestamp("last_token_issued_at").nullable();
    });
    this.defer(async (db) => {
      await db.rawQuery("UPDATE users SET last_token_issued_at = last_active_at");
    });
    this.schema.alterTable("users", (table) => {
      table.dropColumn("last_active_at");
    });
    this.schema.dropTable("remember_me_tokens");
    this.schema.dropTable("sessions");
  }
}
