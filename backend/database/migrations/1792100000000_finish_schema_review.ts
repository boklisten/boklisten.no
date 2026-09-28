import { BaseSchema } from "@adonisjs/lucid/schema";

/** The two invoice numbers that were reused (2020): the credit-noted original of each pair. */
const CREDITED_DUPLICATES = ["5e1f3310d42aac001c75a394", "5fedd0201cf347001c4a7e00"];

/** The one item that is not a book (a calculator, isbn 999). */
const CALCULATOR_ID = "5b6441b4d2e733002fae87ea";

const INVOICE_STATUSES = ["unpaid", "paid", "credit-note", "debt-collection", "loss-note"];

/**
 * Columns that held `''` (or `'0'`) for "unknown" and now hold NULL, with the placeholders; `down()`
 * writes the first one back.
 */
const PLACEHOLDERS: {
  table: string;
  columns: string[];
  placeholders: string[];
  default?: string;
}[] = [
  {
    table: "users",
    columns: ["name", "address", "post_code", "post_city"],
    placeholders: [""],
    default: "",
  },
  { table: "companies", columns: ["email", "phone"], placeholders: ["0", ""] },
  {
    table: "invoices",
    columns: [
      "customer_name",
      "customer_email",
      "customer_phone",
      "customer_address",
      "customer_post_code",
      "customer_post_city",
    ],
    // Only email and phone ever held "0"; down() restores the first placeholder, "".
    placeholders: ["", "0"],
  },
];

/**
 * The last steps of the 2026-09-28 schema review, in one migration (decisions by Adrian):
 *
 * - **Unique invoice numbers.** Two 2020 numbers were used twice, each time for a credit-noted
 *   invoice and its paid reissue. The credited original gets a `-K` suffix, so the number the
 *   customer paid against stays, and the plain index becomes a `UNIQUE` constraint.
 * - **One invoice status.** The four flags (`customer_has_paid`, `to_credit_note`,
 *   `to_debt_collection`, `to_loss_note`) were never combined; they become `status` with the
 *   values of `INVOICE_STATUSES` in `shared/invoice.ts`. `invoice_lines.cancel` is renamed
 *   `cancelled`, a state like the other flags.
 * - **blid integrity.** `customer_items.blid` gets a FK to `unique_items(blid)`, `RESTRICT`: a blid
 *   with history can no longer be deleted, only relinked. The 18 blids that no sticker has (key
 *   noise from scanners such as `853ArrowDown`) and the 9 whose sticker sits on another book are
 *   cleared; all 27 are historical rows. `order_items.blid` and `book_handovers.blid` stay
 *   snapshots without a FK; `book_handovers.blid` becomes `text` like the others.
 * - **NULL for unknown.** The `''` placeholders on users' name and address fields, the `'0'` ones
 *   on companies' email and phone, and both in the contact fields invoices copy from them become
 *   NULL. A `<> ''` CHECK keeps them out of users; companies' phone gets the 8-digit CHECK users
 *   already have.
 * - **`branches.region`** is stored capitalised (`oslo` → `Oslo`), which is how the branch picker
 *   groups it. There is no fixed list.
 * - **ISBN.** `items.isbn` is NULL for items that are not books (the calculator was `999`) and
 *   otherwise must be a 978/979 EAN.
 * - `branches.type` and `invoices.type` stay nullable; a column comment says what NULL means.
 *
 * `down()` restores the schema and the two invoice numbers, not the other cleared or respelt values
 * (blids, placeholders, region case).
 */
export default class extends BaseSchema {
  override async up() {
    // Unique invoice numbers.
    this.schema.raw(
      `update invoices set invoice_number = invoice_number || '-K'
       where id in (${CREDITED_DUPLICATES.map((id) => `'${id}'`).join(", ")})
         and invoice_number not like '%-K'`,
    );
    this.schema.raw(`drop index invoices_invoice_number_index`);
    this.schema.raw(
      `alter table invoices add constraint invoices_invoice_number_unique unique (invoice_number)`,
    );

    // Invoice status. The order matches the one legacy bl-admin coloured rows by.
    this.schema.raw(`alter table invoices add column status text not null default 'unpaid'`);
    this.schema.raw(`
      update invoices set status = case
        when to_debt_collection then 'debt-collection'
        when customer_has_paid then 'paid'
        when to_credit_note then 'credit-note'
        when to_loss_note then 'loss-note'
        else 'unpaid'
      end`);
    this.schema.raw(
      `alter table invoices add constraint invoices_status_check check (status in (${INVOICE_STATUSES.map((status) => `'${status}'`).join(", ")}))`,
    );
    this.schema.raw(
      `alter table invoices
         drop column customer_has_paid,
         drop column to_credit_note,
         drop column to_debt_collection,
         drop column to_loss_note`,
    );
    this.renameColumn("invoice_lines", "cancel", "cancelled");

    // blid integrity.
    this.schema.raw(`
      update customer_items set blid = null
      where blid is not null
        and not exists (
          select 1 from unique_items
          where unique_items.blid = customer_items.blid and unique_items.item_id = customer_items.item_id
        )`);
    this.schema.raw(`alter table book_handovers alter column blid type text`);
    this.schema.raw(
      `alter table customer_items add constraint customer_items_blid_foreign
         foreign key (blid) references unique_items (blid) on delete restrict`,
    );

    // NULL for unknown.
    for (const { table, columns, placeholders } of PLACEHOLDERS) {
      for (const column of columns) {
        this.schema.raw(
          `alter table ${table} alter column ${column} drop default, alter column ${column} drop not null`,
        );
        this.schema.raw(
          `update ${table} set ${column} = null
           where ${column} in (${placeholders.map((value) => `'${value}'`).join(", ")})`,
        );
      }
    }
    for (const column of ["name", "address", "post_code", "post_city"]) {
      this.schema.raw(
        `alter table users add constraint users_${column}_check check (${column} <> '')`,
      );
    }
    this.schema.raw(
      `alter table companies add constraint companies_phone_check check (phone ~ '^[0-9]{8}$')`,
    );

    // Region case.
    this.schema.raw(
      `update branches set region = upper(left(region, 1)) || substr(region, 2)
       where region <> upper(left(region, 1)) || substr(region, 2)`,
    );

    // ISBN.
    this.schema.raw(`alter table items alter column isbn drop not null`);
    this.schema.raw(`update items set isbn = null where id = '${CALCULATOR_ID}'`);
    this.schema.raw(
      `alter table items add constraint items_isbn_check check (isbn between 9780000000000 and 9799999999999)`,
    );

    this.schema.raw(
      `comment on column branches.type is 'NULL: a chain, a school or a class with no type of its own'`,
    );
    this.schema.raw(
      `comment on column invoices.type is 'NULL: a company invoice, or one of the oldest invoices'`,
    );
  }

  override async down() {
    this.schema.raw(`comment on column invoices.type is null`);
    this.schema.raw(`comment on column branches.type is null`);

    this.schema.raw(`alter table items drop constraint items_isbn_check`);
    this.schema.raw(`update items set isbn = 999 where id = '${CALCULATOR_ID}'`);
    this.schema.raw(`alter table items alter column isbn set not null`);

    this.schema.raw(`alter table companies drop constraint companies_phone_check`);
    for (const column of ["name", "address", "post_code", "post_city"]) {
      this.schema.raw(`alter table users drop constraint users_${column}_check`);
    }
    for (const { table, columns, placeholders, default: defaultValue } of PLACEHOLDERS) {
      for (const column of columns) {
        this.schema.raw(
          `update ${table} set ${column} = '${placeholders[0]}' where ${column} is null`,
        );
        this.schema.raw(`alter table ${table} alter column ${column} set not null`);
        if (defaultValue !== undefined) {
          this.schema.raw(
            `alter table ${table} alter column ${column} set default '${defaultValue}'`,
          );
        }
      }
    }

    this.schema.raw(`alter table customer_items drop constraint customer_items_blid_foreign`);
    this.schema.raw(`alter table book_handovers alter column blid type varchar(12)`);

    this.renameColumn("invoice_lines", "cancelled", "cancel");
    this.schema.raw(
      `alter table invoices
         add column customer_has_paid boolean not null default false,
         add column to_credit_note boolean not null default false,
         add column to_debt_collection boolean not null default false,
         add column to_loss_note boolean not null default false`,
    );
    this.schema.raw(`
      update invoices set
        customer_has_paid = status = 'paid',
        to_credit_note = status = 'credit-note',
        to_debt_collection = status = 'debt-collection',
        to_loss_note = status = 'loss-note'`);
    this.schema.raw(`alter table invoices drop column status`);

    this.schema.raw(`alter table invoices drop constraint invoices_invoice_number_unique`);
    this.schema.raw(
      `update invoices set invoice_number = left(invoice_number, -2)
       where id in (${CREDITED_DUPLICATES.map((id) => `'${id}'`).join(", ")})
         and invoice_number like '%-K'`,
    );
    this.schema.raw(`create index invoices_invoice_number_index on invoices (invoice_number)`);
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
