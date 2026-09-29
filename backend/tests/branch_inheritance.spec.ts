import { test } from "@japa/runner";

import {
  INHERITED_BRANCH_FIELDS,
  descendantIds,
  followers,
  overridingDescendants,
  resolveInherited,
} from "#shared/branch-inheritance";
import type { InheritanceInput } from "#shared/branch-inheritance";

/** Sonans → Sonans Oslo → Sonans Oslo kveld, plus a sibling campus; only the root holds a value. */
function sonans(overrides: Partial<Record<string, string>> = {}): InheritanceInput<string>[] {
  const override = (id: string) => overrides[id] ?? null;
  return [
    { id: "sonans", parentBranchId: null, override: overrides["sonans"] ?? "employee" },
    { id: "oslo", parentBranchId: "sonans", override: override("oslo") },
    { id: "kveld", parentBranchId: "oslo", override: override("kveld") },
    { id: "bergen", parentBranchId: "sonans", override: override("bergen") },
  ];
}

test.group("branch inheritance resolver", () => {
  test("the field list names the inherited scalars", ({ assert }) => {
    assert.include(INHERITED_BRANCH_FIELDS, "visibility");
    assert.include(INHERITED_BRANCH_FIELDS, "buyoutPercentage");
    assert.lengthOf(INHERITED_BRANCH_FIELDS, 7);
  });

  test("a branch without an override takes the value of the nearest ancestor with one", ({
    assert,
  }) => {
    const resolved = resolveInherited(sonans());
    assert.deepEqual(resolved.get("kveld"), { id: "kveld", value: "employee", sourceId: "sonans" });
    assert.equal(resolved.get("bergen")?.sourceId, "sonans");
    assert.equal(resolved.get("sonans")?.sourceId, "sonans");
  });

  test("an override is the value for the branch and its subtree", ({ assert }) => {
    const resolved = resolveInherited(sonans({ oslo: "public" }));
    assert.deepEqual(resolved.get("oslo"), { id: "oslo", value: "public", sourceId: "oslo" });
    assert.deepEqual(resolved.get("kveld"), { id: "kveld", value: "public", sourceId: "oslo" });
    assert.equal(resolved.get("bergen")?.value, "employee");
  });

  test("a parent missing from the input is a partial tree, and a root must hold a value", ({
    assert,
  }) => {
    assert.throws(
      () => resolveInherited([{ id: "oslo", parentBranchId: "sonans", override: null }]),
      /sonans/,
    );
    assert.throws(
      () => resolveInherited([{ id: "sonans", parentBranchId: null, override: null }]),
      /root/,
    );
  });

  test("the input order does not matter", ({ assert }) => {
    const resolved = resolveInherited(sonans({ oslo: "public" }).toReversed());
    assert.equal(resolved.get("kveld")?.sourceId, "oslo");
    assert.equal(resolved.get("bergen")?.sourceId, "sonans");
    assert.lengthOf([...resolved.keys()], 4);
  });

  test("descendantIds lists everything below, at any depth", ({ assert }) => {
    assert.sameMembers(descendantIds(sonans(), "sonans"), ["oslo", "kveld", "bergen"]);
    assert.deepEqual(descendantIds(sonans(), "oslo"), ["kveld"]);
    assert.deepEqual(descendantIds(sonans(), "kveld"), []);
  });

  test("overridingDescendants lists the descendants that hold an override", ({ assert }) => {
    const branches = sonans({ kveld: "public", bergen: "admin" });
    assert.sameMembers(overridingDescendants(branches, "sonans"), ["kveld", "bergen"]);
    assert.deepEqual(overridingDescendants(branches, "oslo"), ["kveld"]);
    assert.deepEqual(overridingDescendants(sonans(), "sonans"), []);
  });

  test("followers are the descendants an unbroken chain of inheriting branches reaches", ({
    assert,
  }) => {
    assert.sameMembers(followers(sonans(), "sonans"), ["oslo", "kveld", "bergen"]);
    assert.sameMembers(followers(sonans({ oslo: "public" }), "sonans"), ["bergen"]);
    assert.sameMembers(followers(sonans({ oslo: "public" }), "oslo"), ["kveld"]);
    assert.deepEqual(followers(sonans(), "oslo"), ["kveld"]);
  });
});
