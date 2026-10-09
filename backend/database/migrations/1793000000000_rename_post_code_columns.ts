import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Every postal code is called `postal_code`, as the delivery columns already were; users, companies
 * and invoices kept the old `post_code` spelling from the Mongo documents.
 */
export default class extends BaseSchema {
  override async up() {
    this.renameColumn("users", "post_code", "postal_code");
    this.schema.raw(
      `alter table users rename constraint users_post_code_check to users_postal_code_check`,
    );
    this.renameColumn("companies", "post_code", "postal_code");
    this.renameColumn("invoices", "customer_post_code", "customer_postal_code");
  }

  override async down() {
    this.renameColumn("invoices", "customer_postal_code", "customer_post_code");
    this.renameColumn("companies", "postal_code", "post_code");
    this.schema.raw(
      `alter table users rename constraint users_postal_code_check to users_post_code_check`,
    );
    this.renameColumn("users", "postal_code", "post_code");
  }

  /** Renames the column and, on PG 18, its named NOT NULL constraint with it. */
  private renameColumn(table: string, from: string, to: string) {
    this.schema.raw(`alter table ${table} rename column ${from} to ${to}`);
    this.schema.raw(`
      do $$ begin
        if exists (select 1 from pg_constraint
                   where conrelid = '${table}'::regclass and conname = '${table}_${from}_not_null') then
          alter table ${table} rename constraint ${table}_${from}_not_null to ${table}_${to}_not_null;
        end if;
      end $$`);
  }
}
