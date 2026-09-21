import Branch from "#models/branch";
import Item from "#models/item";
import User from "#models/user";

/**
 * Report rows are aggregated in Mongo while the catalogue and the branches live in Postgres, so
 * an aggregation projects the foreign id and these helpers join the Postgres columns in
 * afterwards. The id key is replaced in place by whatever the callback returns, so the CSV keeps
 * the column order the projection spelled out.
 */
export async function withItemColumns<Row extends { itemId: string | null }, Extra extends object>(
  rows: Row[],
  columns: (item: Item | undefined) => Extra,
): Promise<(Omit<Row, "itemId"> & Extra)[]> {
  const items = await Item.byIds(rows.map((row) => row.itemId));
  return rows.map((row) => replaceKey(row, "itemId", columns(lookup(items, row.itemId))));
}

/** Replaces `key` (a user id or null) in place with whatever `columns` returns for that user. */
export async function withUserColumns<
  Row extends Record<Key, string | null>,
  Key extends string,
  Extra extends object,
>(
  rows: Row[],
  key: Key,
  columns: (user: User | undefined) => Extra,
): Promise<(Omit<Row, Key> & Extra)[]> {
  const users = await User.byIds(rows.map((row) => row[key]));
  return rows.map((row) => replaceKey(row, key, columns(lookup(users, row[key]))));
}

/** Replaces `key` (a branch id or null) with `{ [as]: <branch name or null> }` in place. */
export async function withBranchName<
  Row extends Record<Key, string | null>,
  Key extends string,
  As extends string,
>(rows: Row[], key: Key, as: As): Promise<(Omit<Row, Key> & Record<As, string | null>)[]> {
  const names = await Branch.namesByIds(rows.map((row) => row[key]));
  return rows.map((row) =>
    replaceKey(
      row,
      key,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a computed key cannot be typed as Record<As, …> without the assertion
      { [as]: lookup(names, row[key]) ?? null } as Record<As, string | null>,
    ),
  );
}

function lookup<T>(map: Map<string, T>, id: string | null): T | undefined {
  return id === null ? undefined : map.get(id);
}

function replaceKey<Row extends object, Key extends string, Extra extends object>(
  row: Row,
  key: Key,
  extra: Extra,
): Omit<Row, Key> & Extra {
  const entries: [string, unknown][] = Object.entries(row).flatMap(
    ([entryKey, value]): [string, unknown][] =>
      entryKey === key ? Object.entries(extra) : [[entryKey, value]],
  );
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- rebuilt from Row's own entries plus the extra columns
  return Object.fromEntries(entries) as Omit<Row, Key> & Extra;
}
