import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  override async up() {
    this.schema.createTable("branch_subjects", (table) => {
      table.increments("id");
      table.string("branch_id", 24).notNullable();
      // What customers see when ordering.
      table.string("name").notNullable();
      // The key subject-choice uploads are matched against.
      table.string("external_name").notNullable();

      table.timestamp("created_at");
      table.timestamp("updated_at");

      table.index(["branch_id"]);
    });

    this.schema.raw(
      `CREATE UNIQUE INDEX branch_subjects_branch_name_unique
       ON branch_subjects (branch_id, lower(name))`,
    );
    this.schema.raw(
      `CREATE UNIQUE INDEX branch_subjects_branch_external_name_unique
       ON branch_subjects (branch_id, lower(external_name))`,
    );

    this.schema.createTable("branch_subject_books", (table) => {
      table.increments("id");
      table
        .integer("branch_subject_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("branch_subjects")
        .onDelete("CASCADE");
      table.string("item_id", 24).notNullable();

      table.boolean("rent").notNullable().defaultTo(false);
      table.boolean("partly_payment").notNullable().defaultTo(false);
      table.boolean("buy").notNullable().defaultTo(false);
      table.boolean("rent_at_branch").notNullable().defaultTo(false);
      table.boolean("partly_payment_at_branch").notNullable().defaultTo(false);
      table.boolean("buy_at_branch").notNullable().defaultTo(false);

      table.timestamp("created_at");
      table.timestamp("updated_at");

      table.unique(["branch_subject_id", "item_id"]);
      table.index(["item_id"]);
    });
  }

  override async down() {
    this.schema.dropTable("branch_subject_books");
    this.schema.dropTable("branch_subjects");
  }
}
