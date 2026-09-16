import Item from "#models/item";
import type { Item as ItemDto } from "#shared/item";
import { fixtureId } from "#tests/fixtures";

let sequence = 0;

/**
 * Inserts a catalogue item into the test Postgres with every required column filled. Pass only
 * what the test cares about; the ISBN defaults to a unique 13-digit number so several fixtures
 * can coexist.
 */
export async function createItem(overrides: Partial<ItemDto> = {}): Promise<Item> {
  sequence++;
  return Item.create({
    id: fixtureId(`e${sequence.toString(16)}`),
    title: `Bok ${sequence}`,
    price: 500,
    isbn: 9_780_000_000_000 + sequence,
    subject: "Matematikk 1T",
    year: 2020,
    weight: 0.8,
    distributor: "FS",
    discount: 0.15,
    publisher: "cd",
    active: true,
    buyback: false,
    priceHistory: { "2026": 500 },
    ...overrides,
  });
}
