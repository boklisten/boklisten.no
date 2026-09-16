import Item from "#models/item";

/**
 * Report rows are aggregated in Mongo while the catalogue lives in Postgres, so an aggregation
 * projects the item id and this joins the catalogue columns in afterwards. The `itemId` key is
 * replaced in place by whatever `columns` returns, so the CSV keeps the column order the
 * projection spelled out.
 */
export async function withItemColumns<Row extends { itemId: string | null }, Extra extends object>(
  rows: Row[],
  columns: (item: Item | undefined) => Extra,
): Promise<(Omit<Row, "itemId"> & Extra)[]> {
  const items = await Item.byIds(rows.map((row) => row.itemId));
  return rows.map((row) => {
    const item = row.itemId === null ? undefined : items.get(row.itemId);
    const entries: [string, unknown][] = Object.entries(row).flatMap(
      ([key, value]): [string, unknown][] =>
        key === "itemId" ? Object.entries(columns(item)) : [[key, value]],
    );
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- rebuilt from Row's own entries plus the columns
    return Object.fromEntries(entries) as Omit<Row, "itemId"> & Extra;
  });
}
