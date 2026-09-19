import BadRequestException from "#exceptions/bad_request_exception";
import Item from "#models/item";
import { findItemByIsbn } from "#services/item_lookup";

/** The flat shape the admin book form sends. */
export interface ItemInput {
  title: string;
  isbn: number;
  subject: string;
  year: number;
  price: number;
  /** Kilograms; null when unknown. */
  weight: number | null;
  distributor: string;
  discount: number;
  publisher: string;
  active: boolean;
  buyback: boolean;
}

type ItemPatch = Partial<ItemInput>;

/** A spreadsheet row: the book, plus the id the row was downloaded with when it has one. */
type BulkUpsertRow = ItemInput & { id?: string };

interface BulkUpsertSummary {
  createdCount: number;
  updatedCount: number;
  errors: { isbn: number; title: string; message: string }[];
}

export function currentPriceYear(now = new Date()): string {
  return String(now.getFullYear());
}

function withoutUndefined<T extends object>(patch: T): Partial<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the entries are T's own, minus the undefined ones
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** A price change also replaces this year's entry in the price history; other years stay. */
export function applyPatch(item: Item, patch: ItemPatch, year: string): Item {
  item.merge(withoutUndefined(patch));
  if (patch.price !== undefined) {
    item.priceHistory = { ...item.priceHistory, [year]: patch.price };
  }
  return item;
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
  return Item.create({ ...input, priceHistory: { [currentPriceYear()]: input.price } });
}

async function update(id: string, patch: ItemPatch): Promise<Item> {
  const item = await Item.findOrFail(id);
  if (patch.isbn !== undefined) {
    await assertIsbnAvailable(patch.isbn, id);
  }
  return applyPatch(item, patch, currentPriceYear()).save();
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
        id === undefined ? await findItemByIsbn(String(input.isbn)) : await Item.find(id);
      if (id !== undefined && existing === null) {
        throw new BadRequestException(`Fant ingen bok med id ${id}`);
      }
      if (existing === null) {
        await Item.create({ ...input, priceHistory: { [year]: input.price } });
        summary.createdCount++;
      } else {
        await assertIsbnAvailable(input.isbn, existing.id);
        await applyPatch(existing, input, year).save();
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
