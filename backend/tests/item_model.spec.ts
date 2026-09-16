import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import Item from "#models/item";
import { isObjectIdHex } from "#models/helpers/object_id";
import { fixtureId } from "#tests/fixtures";
import { createItem } from "#tests/item_fixtures";

test.group("Item model", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a new item gets an ObjectId-shaped primary key", async ({ assert }) => {
    const item = await createItem({ id: "" });
    assert.isTrue(isObjectIdHex(item.id));
    assert.equal((await Item.findOrFail(item.id)).id, item.id);
  });

  test("isbn round-trips as a number although Postgres stores it as bigint", async ({ assert }) => {
    await createItem({ isbn: 9_788_293_092_032 });
    const [stored] = await Item.all();
    assert.strictEqual(stored?.isbn, 9_788_293_092_032);
    assert.equal((await Item.findByIsbn(9_788_293_092_032))?.id, stored?.id);
  });

  test("price history and an unknown weight round-trip", async ({ assert }) => {
    const item = await createItem({ weight: null, priceHistory: { "2024": 800, "2026": 850 } });
    const stored = await Item.findOrFail(item.id);
    assert.isNull(stored.weight);
    assert.deepEqual(stored.priceHistory, { "2024": 800, "2026": 850 });
  });

  test("byIds and titlesByIds skip unknown, null and repeated ids", async ({ assert }) => {
    const a = await createItem({ title: "A" });
    const b = await createItem({ title: "B" });

    const items = await Item.byIds([a.id, null, undefined, a.id, fixtureId("dead"), b.id]);
    assert.deepEqual([...items.keys()].toSorted(), [a.id, b.id].toSorted());
    assert.deepEqual(await Item.titlesByIds([]), new Map());
    assert.equal((await Item.titlesByIds([b.id])).get(b.id), "B");
  });

  test("the activeOnly scope hides inactive titles", async ({ assert }) => {
    await createItem({ title: "Aktiv", active: true });
    await createItem({ title: "Utgått", active: false });
    const active = await Item.query().withScopes((scopes) => scopes.activeOnly());
    assert.deepEqual(
      active.map((item) => item.title),
      ["Aktiv"],
    );
  });
});
