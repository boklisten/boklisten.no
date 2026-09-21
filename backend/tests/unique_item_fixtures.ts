import UniqueItem from "#models/unique_item";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

/**
 * Inserts a sticker into the test Postgres. The item must exist already (`createItem`), since
 * `item_id` is a foreign key; the blid defaults to a unique eight-digit one.
 */
export async function createUniqueItem({
  itemId,
  blid,
  id,
}: {
  itemId: string;
  blid?: string;
  id?: string;
}): Promise<UniqueItem> {
  sequence++;
  return UniqueItem.create({
    id: id ?? fixtureId(`f${sequence.toString(16)}`),
    blid: blid ?? (10_000_000 + sequence).toString(),
    itemId,
  });
}
