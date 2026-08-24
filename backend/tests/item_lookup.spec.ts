import { test } from "@japa/runner";
import sinon, { createSandbox } from "sinon";

import { findItemByIsbn, findUniqueItemByBlid } from "#services/item_lookup";
import { StorageService } from "#services/storage_service";

test.group("item_lookup", (group) => {
  let sandbox: sinon.SinonSandbox;
  let itemsStub: { getByQueryOrNull: sinon.SinonStub };
  let uniqueItemsStub: { getByQueryOrNull: sinon.SinonStub };

  group.each.setup(() => {
    sandbox = createSandbox();
    itemsStub = { getByQueryOrNull: sandbox.stub() };
    uniqueItemsStub = { getByQueryOrNull: sandbox.stub() };
    sandbox.stub(StorageService, "Items").value(itemsStub);
    sandbox.stub(StorageService, "UniqueItems").value(uniqueItemsStub);
  });

  group.each.teardown(() => {
    sandbox.restore();
  });

  test("findItemByIsbn returns the item carrying the isbn", async ({ assert }) => {
    const item = { id: "item1", title: "Matematikk 1T" };
    itemsStub.getByQueryOrNull.resolves([item]);

    assert.equal(await findItemByIsbn("9788203208119"), item);
  });

  test("findItemByIsbn filters on the nested isbn field", async ({ assert }) => {
    itemsStub.getByQueryOrNull.resolves([{ id: "item1", title: "Matematikk 1T" }]);

    await findItemByIsbn("9788203208119");

    const [query] = itemsStub.getByQueryOrNull.firstCall.args;
    assert.deepEqual(query.stringFilters, [{ fieldName: "info.isbn", value: "9788203208119" }]);
  });

  // A book we do not stock is an ordinary outcome, not a server error: getByQuery would throw
  // BlError("not found") here, which is why the lookup uses getByQueryOrNull.
  test("findItemByIsbn returns null when nothing matches", async ({ assert }) => {
    itemsStub.getByQueryOrNull.resolves(null);

    assert.equal(await findItemByIsbn("9788203208119"), null);
  });

  test("findItemByIsbn returns null for an empty result", async ({ assert }) => {
    itemsStub.getByQueryOrNull.resolves([]);

    assert.equal(await findItemByIsbn("9788203208119"), null);
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
