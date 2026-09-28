import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import { PublicBlidLookupService } from "#services/public_blid_lookup_service";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { createItem } from "#tests/item_fixtures";
import { createUniqueItem } from "#tests/unique_item_fixtures";
import { createUser } from "#tests/user_fixtures";

const CUSTOMER_ID = "5f7f7f7f7f7f7f7f7f7f7f7f";
const BLID = "12345678";
const ITEM_ID = "5f7f7f7f7f7f7f7f7f7f7f01";
const BRANCH_ID = "5f7f7f7f7f7f7f7f7f7f7f11";

test.group("PublicBlidLookupService.lookup()", (group) => {
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createItem({ id: ITEM_ID, title: "Sinus 1T", isbn: 9_788_202_418_304 });
    await createBranch({ id: BRANCH_ID, name: "Ullern VGS" });
    await createUser({
      id: CUSTOMER_ID,
      name: "Ola Nordmann",
      email: "ola@example.com",
      phone: "12345678",
    });
  });

  const copy = (returned: boolean) =>
    createCustomerItem({
      blid: BLID,
      itemId: ITEM_ID,
      customerId: CUSTOMER_ID,
      handoutBranchId: BRANCH_ID,
      handedOutAt: DateTime.fromISO("2026-08-20T10:00:00.000Z"),
      deadline: DateTime.fromISO("2026-12-20"),
      returned,
    });

  test("a book someone holds right now is reported with its holder", async ({ assert }) => {
    await copy(true);
    await copy(false);

    const result = await PublicBlidLookupService.lookup(BLID);

    assert.equal(result.status, "handedOut");
    assert.include(result, {
      name: "Ola Nordmann",
      email: "ola@example.com",
      phone: "12345678",
      title: "Sinus 1T",
      isbn: "9788202418304",
      handoutBranch: "Ullern VGS",
    });
    if (result.status === "handedOut") {
      assert.equal(new Date(result.handoutTime).toISOString(), "2026-08-20T10:00:00.000Z");
      assert.equal(result.deadline, "2026-12-20");
    }
    assert.notProperty(result, "itemId");
  });

  test("a registered book nobody holds is reported as not handed out with its title and ISBN", async ({
    assert,
  }) => {
    await createUniqueItem({ itemId: ITEM_ID, blid: BLID });

    const result = await PublicBlidLookupService.lookup(BLID);

    assert.deepEqual(result, { status: "notHandedOut", title: "Sinus 1T", isbn: "9788202418304" });
  });

  test("a legacy blid known only from a returned customer item is still reported as not handed out", async ({
    assert,
  }) => {
    await copy(true);

    const result = await PublicBlidLookupService.lookup(BLID);

    assert.deepEqual(result, { status: "notHandedOut", title: "Sinus 1T", isbn: "9788202418304" });
  });

  test("a blid Boklisten has never seen is reported as unregistered", async ({ assert }) => {
    const result = await PublicBlidLookupService.lookup(BLID);

    assert.deepEqual(result, { status: "unregistered" });
  });
});

test.group("PublicBlidLookupService.opensAt()", () => {
  const now = new Date("2026-09-13T12:00:00.000Z");

  test("a user registered less than 24 hours ago is told when lookups open", ({ assert }) => {
    const opensAt = PublicBlidLookupService.opensAt(new Date("2026-09-13T08:30:00.000Z"), now);

    assert.deepEqual(opensAt, new Date("2026-09-14T08:30:00.000Z"));
  });

  test("a user registered more than 24 hours ago may look up books", ({ assert }) => {
    assert.isNull(PublicBlidLookupService.opensAt(new Date("2026-09-12T11:59:00.000Z"), now));
  });
});
