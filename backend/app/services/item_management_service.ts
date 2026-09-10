import BadRequestException from "#exceptions/bad_request_exception";
import { findItemByIsbn } from "#services/item_lookup";
import { StorageService } from "#services/storage_service";
import type { Item } from "#shared/item";

/** The flat shape the admin book form sends; the stored document nests most of it under `info`. */
export interface ItemInput {
  title: string;
  isbn: number;
  subject: string;
  year: number;
  price: number;
  weight: number;
  distributor: string;
  discount: number;
  publisher: string;
  active: boolean;
  buyback: boolean;
}

export type ItemPatch = Partial<ItemInput>;

/** A spreadsheet row: the book, plus the id the row was downloaded with when it has one. */
export type BulkUpsertRow = ItemInput & { id?: string };

export interface BulkUpsertSummary {
  createdCount: number;
  updatedCount: number;
  errors: { isbn: number; title: string; message: string }[];
}

export function currentPriceYear(now = new Date()): string {
  return String(now.getFullYear());
}

function withoutUndefined(paths: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(paths).filter(([, value]) => value !== undefined));
}

/** A price change also replaces this year's entry in the price history; other years stay. */
export function buildItemUpdate(patch: ItemPatch, year: string): Record<string, unknown> {
  const { title, price, active, buyback, weight, ...info } = patch;
  const infoPaths = Object.entries(info).map(([field, value]) => [`info.${field}`, value]);
  return withoutUndefined({
    title,
    price,
    active,
    buyback,
    ...Object.fromEntries(infoPaths),
    "info.weight": weight === undefined ? undefined : String(weight),
    [`info.price.${year}`]: price,
  });
}

export function buildNewItem(input: ItemInput, year: string): Omit<Item, "id"> {
  return {
    title: input.title,
    price: input.price,
    active: input.active,
    buyback: input.buyback,
    info: {
      isbn: input.isbn,
      subject: input.subject,
      year: input.year,
      price: { [year]: input.price },
      weight: String(input.weight),
      distributor: input.distributor,
      discount: input.discount,
      publisher: input.publisher,
    },
  };
}

async function assertIsbnAvailable(isbn: number, exceptItemId?: string) {
  const existing = await findItemByIsbn(String(isbn));
  if (existing !== null && existing.id !== exceptItemId) {
    throw new BadRequestException(`ISBN ${isbn} er allerede i bruk av «${existing.title}»`);
  }
}

/** Values that occur more than once, each listed once in first-seen order. */
export function duplicates<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const repeated = new Set<T>();
  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }
    seen.add(value);
  }
  return [...repeated];
}

async function create(input: ItemInput): Promise<Item> {
  await assertIsbnAvailable(input.isbn);
  return StorageService.Items.add(buildNewItem(input, currentPriceYear()));
}

async function update(id: string, patch: ItemPatch): Promise<Item> {
  if (patch.isbn !== undefined) {
    await assertIsbnAvailable(patch.isbn, id);
  }
  return StorageService.Items.update(id, buildItemUpdate(patch, currentPriceYear()));
}

/**
 * Spreadsheet upload, matching legacy bl-admin: a row with an id updates that book (its ISBN may
 * change), a row without one updates the book with the same ISBN or creates a new book.
 * Rows are written one by one (no transaction), so a failing row is reported and the rest still land.
 */
async function bulkUpsert(rows: BulkUpsertRow[]): Promise<BulkUpsertSummary> {
  const repeatedIsbns = duplicates(rows.map((row) => row.isbn));
  if (repeatedIsbns.length > 0) {
    throw new BadRequestException(
      `Filen inneholder samme ISBN flere ganger: ${repeatedIsbns.join(", ")}`,
    );
  }
  const repeatedIds = duplicates(rows.flatMap((row) => (row.id === undefined ? [] : [row.id])));
  if (repeatedIds.length > 0) {
    throw new BadRequestException(
      `Filen inneholder samme id flere ganger: ${repeatedIds.join(", ")}`,
    );
  }
  const year = currentPriceYear();
  const summary: BulkUpsertSummary = { createdCount: 0, updatedCount: 0, errors: [] };
  for (const { id, ...input } of rows) {
    try {
      const existing =
        id === undefined
          ? await findItemByIsbn(String(input.isbn))
          : await StorageService.Items.getOrNull(id);
      if (id !== undefined && existing === null) {
        throw new BadRequestException(`Fant ingen bok med id ${id}`);
      }
      if (existing === null) {
        await StorageService.Items.add(buildNewItem(input, year));
        summary.createdCount++;
      } else {
        await assertIsbnAvailable(input.isbn, existing.id);
        await StorageService.Items.update(existing.id, buildItemUpdate(input, year));
        summary.updatedCount++;
      }
    } catch (error) {
      summary.errors.push({
        isbn: input.isbn,
        title: input.title,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return summary;
}

export const ItemManagementService = { create, update, bulkUpsert };
