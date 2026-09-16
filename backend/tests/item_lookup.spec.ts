import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import type sinon from "sinon";
import { createSandbox } from "sinon";

import { findItemByIsbn, findUniqueItemByBlid } from "#services/item_lookup";
import { StorageService } from "#services/storage_service";
import { createItem } from "#tests/item_fixtures";

test.group("item_lookup", (group) => {
  let sandbox: sinon.SinonSandbox;
  let uniqueItemsStub: { getByQueryOrNull: sinon.SinonStub };

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
    uniqueItemsStub = { getByQueryOrNull: sandbox.stub() };
    sandbox.stub(StorageService, "UniqueItems").value(uniqueItemsStub);
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

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

  test("findUniqueItemByBlid returns the unique item a blid is connected to", async ({
    assert,
  }) => {
    const uniqueItem = { id: "unique1", blid: "12345678", item: "item1", title: "Matematikk 1T" };
    uniqueItemsStub.getByQueryOrNull.resolves([uniqueItem]);

    assert.equal(await findUniqueItemByBlid("12345678"), uniqueItem);
  });

  test("findUniqueItemByBlid filters on blid", async ({ assert }) => {
    uniqueItemsStub.getByQueryOrNull.resolves([{ id: "unique1" }]);

    await findUniqueItemByBlid("12345678");

    const [query] = uniqueItemsStub.getByQueryOrNull.firstCall.args;
    assert.deepEqual(query.stringFilters, [{ fieldName: "blid", value: "12345678" }]);
  });

  test("findUniqueItemByBlid returns null for an unconnected blid", async ({ assert }) => {
    uniqueItemsStub.getByQueryOrNull.resolves(null);

    assert.equal(await findUniqueItemByBlid("12345678"), null);
  });
});
