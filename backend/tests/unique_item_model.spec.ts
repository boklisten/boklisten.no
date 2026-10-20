import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import { isObjectIdHex } from "#models/helpers/object_id";
import UniqueItem from "#models/unique_item";
import { BranchScope } from "#services/branch_scope";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createUniqueItem } from "#tests/unique_item_fixtures";
import { createUser } from "#tests/user_fixtures";

/** A scope over the branches, with the customers in it, as `BlidSearchService.search` builds it. */
function scopeOf(ids: string[]) {
  return { ids, customers: BranchScope.customersInScope(ids) };
}

test.group("UniqueItem model", (group) => {
  // Truncated, not rolled back: these tests make Postgres reject a write, which would abort a
  // shared transaction and fail every later query in the test.
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
    const [item, branch] = await Promise.all([createItem(), createBranch()]);
    await createUniqueItem({ itemId: item.id, blid: "zzABCDzzzzzz" });
    await createUniqueItem({ itemId: item.id, blid: "abcd12345678" });
    await createUniqueItem({ itemId: item.id, blid: "12345678" });

    assert.sameDeepMembers(await UniqueItem.matching("abcd", scopeOf([branch.id])), [
      { blid: "abcd12345678", itemId: item.id, holderId: null },
      { blid: "zzABCDzzzzzz", itemId: item.id, holderId: null },
    ]);
  });

  test("matching names the customer actively holding the sticker", async ({ assert }) => {
    const [item, branch, customer] = await Promise.all([
      createItem(),
      createBranch(),
      createUser(),
    ]);
    await createUniqueItem({ itemId: item.id, blid: "abcd12345678" });
    const loan = { itemId: item.id, handoutBranchId: branch.id, blid: "abcd12345678" };
    await createCustomerItem({ ...loan, customerId: (await createUser()).id, returned: true });
    await createCustomerItem({ ...loan, customerId: customer.id });

    assert.deepEqual(await UniqueItem.matching("abcd", scopeOf([branch.id])), [
      { blid: "abcd12345678", itemId: item.id, holderId: customer.id },
    ]);
  });

  test("matching leaves out a sticker held by a book handed out outside the scope", async ({
    assert,
  }) => {
    const [item, branch, elsewhere, customer] = await Promise.all([
      createItem(),
      createBranch(),
      createBranch(),
      createUser(),
    ]);
    // A pupil of the other school; a customer with no school is in every stand's scope.
    await customer.merge({ branchMembershipId: elsewhere.id }).save();
    await createUniqueItem({ itemId: item.id, blid: "abcd00000001" });
    await createCustomerItem({
      itemId: item.id,
      handoutBranchId: elsewhere.id,
      blid: "abcd00000002",
      customerId: customer.id,
    });

    assert.deepEqual(await UniqueItem.matching("abcd", scopeOf([branch.id])), [
      { blid: "abcd00000001", itemId: item.id, holderId: null },
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
