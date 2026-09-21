import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";

import User from "#models/user";
import { createBranch } from "#tests/branch_fixtures";
import { createUser } from "#tests/user_fixtures";

test.group("User lookups", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("finds a user by email regardless of case and surrounding whitespace", async ({
    assert,
  }) => {
    const user = await createUser({ email: "kari.nordmann@example.com" });

    assert.equal((await User.byEmail("  Kari.Nordmann@Example.com "))?.id, user.id);
    assert.isNull(await User.byEmail("ola@example.com"));
  });

  test("byUsername picks email or phone by the shape of the input", async ({ assert }) => {
    const user = await createUser({ email: "kari@example.com", phone: "91234567" });

    assert.equal((await User.byUsername("kari@example.com"))?.id, user.id);
    assert.equal((await User.byUsername("91234567"))?.id, user.id);
    assert.equal((await User.byUsername(" +47 912 34 567 "))?.id, user.id);
    assert.isNull(await User.byUsername("91234568"));
  });

  test("counts direct members of the given branches", async ({ assert }) => {
    const branch = await createBranch();
    const other = await createBranch();
    await createUser({ branchMembershipId: branch.id });
    await createUser({ branchMembershipId: branch.id });
    await createUser({ branchMembershipId: other.id });
    await createUser({ branchMembershipId: null });

    assert.equal(await User.countMembersOf([branch.id]), 2);
    assert.equal(await User.countMembersOf([branch.id, other.id]), 3);
    assert.equal(await User.countMembersOf([]), 0);
  });

  test("lists employees, managers and admins by name, never customers", async ({ assert }) => {
    await createUser({ name: "Zara", permission: "admin" });
    await createUser({ name: "Anne", permission: "employee" });
    await createUser({ name: "Kunde", permission: "customer" });

    const employees = await User.employees();

    assert.deepEqual(
      employees.map((employee) => employee.name),
      ["Anne", "Zara"],
    );
  });
});

test.group("User.search", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("matches the customer's own details and their guardian's, case-insensitively", async ({
    assert,
  }) => {
    const byName = await createUser({ name: "Kari Nordmann" });
    const byGuardian = await createUser({ name: "Per Hansen", guardianEmail: "nordmann@x.no" });
    await createUser({ name: "Ola Olsen" });

    const hits = await User.search("NORDMANN");

    assert.sameMembers(
      hits.map((hit) => hit.id),
      [byName.id, byGuardian.id],
    );
  });

  test("ranks matches on the customer's own name, phone or email above address matches, newest first", async ({
    assert,
  }) => {
    const byAddress = await createUser({ name: "Anne", address: "Solveien 1" });
    const olderByName = await createUser({ name: "Sol Berg" });
    const newerByName = await createUser({ name: "Solveig Dal" });
    await User.query()
      .where("id", olderByName.id)
      .update({ createdAt: DateTime.now().minus({ years: 1 }).toSQL() });

    const hits = await User.search("sol");

    assert.deepEqual(
      hits.map((hit) => hit.id),
      [newerByName.id, olderByName.id, byAddress.id],
    );
  });

  test("treats SQL wildcards in the search text literally", async ({ assert }) => {
    await createUser({ name: "Kari Nordmann" });
    const withPercent = await createUser({ name: "100% Bok" });

    assert.deepEqual(
      (await User.search("%")).map((hit) => hit.id),
      [withPercent.id],
    );
    assert.isEmpty(await User.search("   "));
  });
});

test.group("User.toDto", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("presents the date of birth as a calendar date and leaves the credentials out", async ({
    assert,
  }) => {
    const user = await createUser({
      dob: DateTime.fromISO("2008-02-29"),
      localHashedPassword: "$scrypt$secret",
      vippsUserId: "vipps-1",
    });

    const dto = (await User.findOrFail(user.id)).toDto();

    assert.equal(dto.dob, "2008-02-29");
    assert.notProperty(dto, "localHashedPassword");
    assert.notProperty(dto, "vippsUserId");
    assert.notProperty(user.serialize(), "localHashedPassword");
    assert.instanceOf(dto.createdAt, Date);
  });
});
