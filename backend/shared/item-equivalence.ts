/**
 * Temporary workaround for books that customers have ordered interchangeably across editions.
 * Scanning any item id in a group satisfies an order/match for any other id in the same group.
 *
 * This is intentionally a hardcoded list. The sustainable replacement is an equivalence
 * field/group on the Item model; when that exists, only the body of `getEquivalentItemIds`
 * needs to change — call sites stay the same.
 */
const EQUIVALENT_ITEM_GROUPS: string[][] = [
  ["5b6441c6d2e733002fae89eb", "5b6441c1d2e733002fae8960"], // Veien til toppidrett / Veien til toppidrett 2014
  ["5b6441c4d2e733002fae89a6", "5b6441b2d2e733002fae87a6"], // GYMNOS 2009 / GYMNOS 2012
];

/**
 * Returns all item ids equivalent to the given id, including the id itself.
 * For an id that is not part of any equivalence group, returns `[itemId]`.
 */
export function getEquivalentItemIds(itemId: string): string[] {
  return EQUIVALENT_ITEM_GROUPS.find((group) => group.includes(itemId)) ?? [itemId];
}

/**
 * Whether two item ids are interchangeable (the same id, or in the same equivalence group).
 */
export function itemsAreEquivalent(a: string, b: string): boolean {
  return getEquivalentItemIds(a).includes(b);
}
