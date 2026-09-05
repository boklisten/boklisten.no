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

export const ItemManagementService = { create, update };
