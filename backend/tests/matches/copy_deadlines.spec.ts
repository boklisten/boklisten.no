import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import CustomerItem from "#models/customer_item";
import { extendRemainingCopyDeadlines } from "#services/matches/copy_deadlines";
import { createBranch } from "#tests/branch_fixtures";
import { createCustomerItem } from "#tests/customer_item_fixtures";
import { ensureUsers, seedTestCatalogue } from "#tests/matches/match-testing-utils";

const A = "5d765db5fc8c47001c408d81";
const B = "5d765db5fc8c47001c408d82";
const BRANCH = "5d765db5fc8c47001c408b01";
const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";
const OTHER_TITLE = "5d765db5fc8c47001c408e01";

const JUNE = DateTime.fromISO("2026-06-15T00:00:00Z");
const AUGUST = DateTime.fromISO("2026-08-20T00:00:00Z");

const deadlineOf = async (customerItem: CustomerItem) =>
  (await CustomerItem.findOrFail(customerItem.id)).deadline.toMillis();

test.group("extendRemainingCopyDeadlines", (group) => {
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(seedTestCatalogue);
  group.each.setup(() => ensureUsers([A, B]));
  group.each.setup(async () => {
    await createBranch({ id: BRANCH });
  });

  const copy = (
    deadline: DateTime,
    overrides: Partial<Parameters<typeof createCustomerItem>[0]> = {},
  ) =>
    createCustomerItem({
      customerId: A,
      itemId: GYMNOS_2009,
      handoutBranchId: BRANCH,
      deadline,
      ...overrides,
    });

  test("the kept copy inherits the later deadline of the pair", async ({ assert }) => {
    // The VG1 student: their own Gymnos is due in June, the one they were given in June runs to
    // August. They hand over the August copy, so the copy they keep must run to August too.
    const june = await copy(JUNE);

    await extendRemainingCopyDeadlines(A, GYMNOS_2009, AUGUST.toJSDate());

    assert.equal(await deadlineOf(june), AUGUST.toMillis());
  });

  test("a copy already running longer is left alone", async ({ assert }) => {
    const august = await copy(AUGUST);

    await extendRemainingCopyDeadlines(A, GYMNOS_2009, JUNE.toJSDate());

    assert.equal(await deadlineOf(august), AUGUST.toMillis());
  });

  test("extends every remaining copy that is running short, and only those", async ({ assert }) => {
    const first = await copy(JUNE);
    const second = await copy(JUNE);
    const returned = await copy(JUNE, { returned: true });
    const someoneElses = await copy(JUNE, { customerId: B });
    const otherTitle = await copy(JUNE, { itemId: OTHER_TITLE });

    await extendRemainingCopyDeadlines(A, GYMNOS_2009, AUGUST.toJSDate());

    assert.equal(await deadlineOf(first), AUGUST.toMillis());
    assert.equal(await deadlineOf(second), AUGUST.toMillis());
    assert.equal(await deadlineOf(returned), JUNE.toMillis());
    assert.equal(await deadlineOf(someoneElses), JUNE.toMillis());
    assert.equal(await deadlineOf(otherTitle), JUNE.toMillis());
  });

  test("looks across equivalent editions", async ({ assert }) => {
    // A student can hold GYMNOS 2009 and GYMNOS 2012 interchangeably, so both count as the
    // same title when deciding which deadline the kept copy carries.
    const edition2012 = await copy(JUNE, { itemId: GYMNOS_2012 });

    await extendRemainingCopyDeadlines(A, GYMNOS_2009, AUGUST.toJSDate());

    assert.equal(await deadlineOf(edition2012), AUGUST.toMillis());
  });
});
