import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import { isObjectIdHex } from "#models/helpers/object_id";
import UniqueItem from "#models/unique_item";
import { createItem } from "#tests/item_fixtures";
import { createUniqueItem } from "#tests/unique_item_fixtures";

test.group("UniqueItem model", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a new sticker gets an ObjectId-shaped primary key", async ({ assert }) => {
    const item = await createItem();
    const uniqueItem = await createUniqueItem({ itemId: item.id, id: "" });
    assert.isTrue(isObjectIdHex(uniqueItem.id));
  });

  test("findByBlid is exact and case-sensitive", async ({ assert }) => {
    const item = await createItem();
    const lower = await createUniqueItem({ itemId: item.id, blid: "abcdefghijkl" });
    await createUniqueItem({ itemId: item.id, blid: "ABCDEFGHIJKL" });

    assert.equal((await UniqueItem.findByBlid("abcdefghijkl"))?.id, lower.id);
    assert.isNull(await UniqueItem.findByBlid("abcdefghijk"));
  });

  test("byBlidsWithItem returns the registered stickers with their books", async ({ assert }) => {
    const item = await createItem({ title: "Sinus 1T" });
    await createUniqueItem({ itemId: item.id, blid: "12345678" });

    const found = await UniqueItem.byBlidsWithItem(["12345678", "87654321", "12345678"]);

    assert.lengthOf(found, 1);
    assert.equal(found[0]?.item.title, "Sinus 1T");
    assert.isEmpty(await UniqueItem.byBlidsWithItem([]));
  });

  test("takenBlids picks the candidates that already exist", async ({ assert }) => {
    const item = await createItem();
    await createUniqueItem({ itemId: item.id, blid: "12345678" });

    assert.deepEqual(await UniqueItem.takenBlids(["12345678", "87654321"]), new Set(["12345678"]));
    assert.deepEqual(await UniqueItem.takenBlids([]), new Set());
  });

  test("matching finds blids containing the text in any casing", async ({ assert }) => {
    const item = await createItem();
    await createUniqueItem({ itemId: item.id, blid: "zzABCDzzzzzz" });
    await createUniqueItem({ itemId: item.id, blid: "abcd12345678" });
    await createUniqueItem({ itemId: item.id, blid: "12345678" });

    assert.sameDeepMembers(await UniqueItem.matching("abcd"), [
      { blid: "abcd12345678", itemId: item.id },
      { blid: "zzABCDzzzzzz", itemId: item.id },
    ]);
  });

  test("the database refuses duplicate blids, malformed blids and unknown items", async ({
    assert,
  }) => {
    const item = await createItem();
    await createUniqueItem({ itemId: item.id, blid: "12345678" });

    await assert.rejects(() => createUniqueItem({ itemId: item.id, blid: "12345678" }));
    await assert.rejects(() => createUniqueItem({ itemId: item.id, blid: "XbCc:Nt7_ åL" }));
    await assert.rejects(() => createUniqueItem({ itemId: item.id, blid: "6188722740399" }));
    await assert.rejects(() =>
      createUniqueItem({ itemId: "5f7f7f7f7f7f7f7f7f7f7f99", blid: "87654321" }),
    );
    // The 2022 batch of eight alphanumeric characters is admitted.
    assert.equal((await createUniqueItem({ itemId: item.id, blid: "PHzei0ho" })).blid, "PHzei0ho");
  });

  test("a title with stickers cannot be deleted from the catalogue", async ({ assert }) => {
    const item = await createItem();
    await createUniqueItem({ itemId: item.id });

    await assert.rejects(() => item.delete());
  });
});
