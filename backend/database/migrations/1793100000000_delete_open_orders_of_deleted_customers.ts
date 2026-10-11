import { BaseSchema } from "@adonisjs/lucid/schema";

/**
 * Deleting a customer now takes their open orders with them (`UserManagementService.deleteUser`),
 * since nobody is left to hand the books to. Before that rule, and before the delete guard it
 * replaced, customers were deleted with orders still open; those orders (26 on staging, from
 * 2019–2022, none with a book handed out) showed up in the order manager under "Ukjent kunde".
 * Their lines, payments and deliveries cascade.
 */
export default class extends BaseSchema {
  override async up() {
    this.defer(async (db) => {
      await db
        .from("orders")
        .whereNull("customer_id")
        .where("placed", true)
        .whereExists((lines) => {
          void lines
            .from("order_items")
            .whereColumn("order_items.order_id", "orders.id")
            .whereIn("order_items.type", ["rent", "partly-payment", "buy"])
            .where("order_items.handout", false)
            .where("order_items.delivered", false)
            .whereNull("order_items.moved_to_order_id");
        })
        .delete();
    });
  }

  /** The orders are not restored. */
  override async down() {}
}
