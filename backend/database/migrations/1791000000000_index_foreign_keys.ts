import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Every foreign key gets an index led by its column, so deleting or merging a user, order, branch
 * or item no longer scans the child table once per constraint. A nullable column gets a partial
 * index: the lookup Postgres makes for a constraint is an equality, which never matches NULL, so
 * the partial index still serves it and stays small for rarely set columns such as
 * `cancel_order_id` (about 1 in 150 customer items).
 *
 * Three indexes go:
 * - `branch_subjects_branch_id_index`: the unique `(branch_id, lower(name))` index covers it.
 * - `orders_placed_updated_at_index`: no query filters or sorts orders by `updated_at`; it only
 *   costs every order write.
 * - `users_permission_index`: fewer than 1 in 200 users are staff, so an index led by the
 *   permission is next to useless. The staff list (`User.employees`) gets a partial index on its sort
 *   column instead.
 *
 * `CONCURRENTLY` keeps the large tables writable while the indexes build, which needs the
 * migration to run outside a transaction.
 */
const FOREIGN_KEY_INDEXES = [
  ["branch_items", "item_id", "not null"],
  ["customer_items", "handout_employee_id", "nullable"],
  ["customer_items", "return_employee_id", "nullable"],
  ["customer_items", "return_branch_id", "nullable"],
  ["customer_items", "cancel_order_id", "nullable"],
  ["customer_items", "buyout_order_id", "nullable"],
  ["customer_items", "buyback_order_id", "nullable"],
  ["deliveries", "branch_id", "nullable"],
  ["email_verifications", "user_detail_id", "not null"],
  ["order_items", "moved_from_order_id", "nullable"],
  ["order_items", "moved_to_order_id", "nullable"],
  ["orders", "employee_id", "nullable"],
  ["password_resets", "user_detail_id", "not null"],
  ["sendouts", "initiated_by_details_id", "nullable"],
  ["waiting_list_customers", "branch_id", "not null"],
  ["waiting_list_customers", "item_id", "not null"],
] as const;

export default class extends BaseSchema {
  static override disableTransactions = true;

  override async up() {
    for (const [table, column, nullability] of FOREIGN_KEY_INDEXES) {
      const partial = nullability === "nullable" ? ` where ${column} is not null` : "";
      this.schema.raw(
        `create index concurrently if not exists ${table}_${column}_index on ${table} (${column})${partial}`,
      );
    }
    this.schema.raw(
      `create index concurrently if not exists users_staff_name_index on users (name) where permission <> 'customer'`,
    );

    this.schema.raw(`drop index concurrently if exists branch_subjects_branch_id_index`);
    this.schema.raw(`drop index concurrently if exists orders_placed_updated_at_index`);
    this.schema.raw(`drop index concurrently if exists users_permission_index`);
  }

  override async down() {
    this.schema.raw(
      `create index concurrently if not exists users_permission_index on users (permission)`,
    );
    this.schema.raw(
      `create index concurrently if not exists orders_placed_updated_at_index on orders (placed, updated_at)`,
    );
    this.schema.raw(
      `create index concurrently if not exists branch_subjects_branch_id_index on branch_subjects (branch_id)`,
    );

    this.schema.raw(`drop index concurrently if exists users_staff_name_index`);
    for (const [table, column] of FOREIGN_KEY_INDEXES) {
      this.schema.raw(`drop index concurrently if exists ${table}_${column}_index`);
    }
  }
}
