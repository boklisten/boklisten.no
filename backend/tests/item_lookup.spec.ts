import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import { findItemByIsbn, findUniqueItemByBlid } from "#services/item_lookup";
import { createItem } from "#tests/item_fixtures";
import { createUniqueItem } from "#tests/unique_item_fixtures";

test.group("item_lookup", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("findItemByIsbn returns the item carrying the isbn", async ({ assert }) => {
    const item = await createItem({ title: "Matematikk 1T", isbn: 9_788_203_208_119 });
    await createItem({ title: "Matematikk R1", isbn: 9_788_203_208_126 });

    const found = await findItemByIsbn("9788203208119");

    assert.equal(found?.id, item.id);
    assert.equal(found?.title, "Matematikk 1T");
  });

  test("findItemByIsbn tolerates surrounding whitespace", async ({ assert }) => {
    const item = await createItem({ isbn: 9_788_203_208_119 });
    assert.equal((await findItemByIsbn(" 9788203208119 "))?.id, item.id);
  });

  // A book we do not stock is an ordinary outcome, not a server error.
  test("findItemByIsbn returns null when nothing matches", async ({ assert }) => {
    await createItem({ isbn: 9_788_203_208_126 });
    assert.isNull(await findItemByIsbn("9788203208119"));
  });

  test("findItemByIsbn returns null for text that is no isbn instead of querying", async ({
    assert,
  }) => {
    assert.isNull(await findItemByIsbn("abc"));
    assert.isNull(await findItemByIsbn(""));
    assert.isNull(await findItemByIsbn("978-82-03-20811-9"));
  });

  test("findUniqueItemByBlid returns the sticker registered under the blid", async ({ assert }) => {
    const item = await createItem({ title: "Matematikk 1T" });
    const uniqueItem = await createUniqueItem({ itemId: item.id, blid: "12345678" });
    await createUniqueItem({ itemId: item.id, blid: "87654321" });

    const found = await findUniqueItemByBlid("12345678");

    assert.equal(found?.id, uniqueItem.id);
    assert.equal(found?.itemId, item.id);
  });

  test("findUniqueItemByBlid returns null for an unregistered blid", async ({ assert }) => {
    assert.isNull(await findUniqueItemByBlid("12345678"));
  });
});
