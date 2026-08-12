import { SEDbQuery } from "#services/legacy/query/se.db-query";
import { StorageService } from "#services/storage_service";
import type { Item } from "#shared/item";
import type { UniqueItem } from "#shared/unique-item";

export async function findItemByIsbn(isbn: string): Promise<Item | null> {
  const databaseQuery = new SEDbQuery();
  databaseQuery.stringFilters = [{ fieldName: "info.isbn", value: isbn }];
  const items = await StorageService.Items.getByQueryOrNull(databaseQuery);
  return items?.[0] ?? null;
}

export async function findUniqueItemByBlid(blid: string): Promise<UniqueItem | null> {
  const databaseQuery = new SEDbQuery();
  databaseQuery.stringFilters = [{ fieldName: "blid", value: blid }];
  const uniqueItems = await StorageService.UniqueItems.getByQueryOrNull(databaseQuery);
  return uniqueItems?.[0] ?? null;
}
