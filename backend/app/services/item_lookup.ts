import Item from "#models/item";
import { SEDbQuery } from "#models/mongoose/storage/db-query";
import { StorageService } from "#services/storage_service";
import type { UniqueItem } from "#shared/unique-item";

/** The book carrying the ISBN, or null for a book we do not stock (or a string that is no ISBN). */
export async function findItemByIsbn(isbn: string): Promise<Item | null> {
  const digits = isbn.trim();
  if (!/^\d{1,18}$/.test(digits)) {
    return null;
  }
  return Item.findByIsbn(Number(digits));
}

export async function findUniqueItemByBlid(blid: string): Promise<UniqueItem | null> {
  const databaseQuery = new SEDbQuery();
  databaseQuery.stringFilters = [{ fieldName: "blid", value: blid }];
  const uniqueItems = await StorageService.UniqueItems.getByQueryOrNull(databaseQuery);
  return uniqueItems?.[0] ?? null;
}
