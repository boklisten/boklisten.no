import Item from "#models/item";
import UniqueItem from "#models/unique_item";

/** The book carrying the ISBN, or null for a book we do not stock (or a string that is no ISBN). */
export async function findItemByIsbn(isbn: string): Promise<Item | null> {
  const digits = isbn.trim();
  if (!/^\d{1,18}$/.test(digits)) {
    return null;
  }
  return Item.findByIsbn(Number(digits));
}

/** The sticker registered under the blid, or null for one Boklisten has not linked to a book. */
export async function findUniqueItemByBlid(blid: string): Promise<UniqueItem | null> {
  return UniqueItem.findByBlid(blid);
}
