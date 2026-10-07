import { beforeCreate, column, scope } from "@adonisjs/lucid/orm";

import { assignObjectId, distinctIds } from "#models/helpers/object_id";
import { ItemSchema } from "#database/schema";

/** A title in the book catalogue; see `shared/item.ts` for the field semantics. */
export default class Item extends ItemSchema {
  static override selfAssignPrimaryKey = true;

  /**
   * int8 arrives from the pg driver as a string; a 13-digit ISBN fits a JS number with room to
   * spare. Null for an item that is not a book.
   */
  @column({ consume: (isbn: string | null) => (isbn === null ? null : Number(isbn)) })
  declare isbn: number | null;

  /** The ISBN as the API sends it, as text. */
  get isbnText(): string | null {
    return this.isbn === null ? null : String(this.isbn);
  }

  /** The price each calendar year, keyed by the year. */
  declare priceHistory: Record<string, number>;

  @beforeCreate()
  static assignId(item: Item) {
    assignObjectId(item);
  }

  /** What customers may see: inactive titles are for employees only. */
  static activeOnly = scope((query) => {
    void query.where("active", true);
  });

  static async findByIsbn(isbn: number): Promise<Item | null> {
    return this.findBy("isbn", isbn);
  }

  /**
   * The items with the given ids, keyed by id. Ids that do not exist are simply absent, which
   * is how callers joining catalogue data onto other query results detect a dangling reference.
   */
  static async byIds(ids: Iterable<string | null | undefined>): Promise<Map<string, Item>> {
    const unique = distinctIds(ids);
    if (unique.length === 0) {
      return new Map();
    }
    const items = await this.findMany(unique);
    return new Map(items.map((item) => [item.id, item]));
  }

  static async titlesByIds(ids: Iterable<string | null | undefined>): Promise<Map<string, string>> {
    const items = await this.byIds(ids);
    return new Map([...items].map(([id, item]) => [id, item.title]));
  }
}
