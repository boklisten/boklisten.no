import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import Branch from "#models/branch";
import BranchPeriod from "#models/branch_period";
import { inheritBelow } from "#services/branch_inheritance_service";
import {
  BranchCycleError,
  createBranch as createBranchThroughService,
  updateBranch,
  updateBranchRelationships,
} from "#services/branch_service";
import { createBranch } from "#tests/branch_fixtures";

const visibilityOf = async (id: string) => (await Branch.findOrFail(id)).visibility;

const parentOf = async (id: string) => (await Branch.findOrFail(id)).parentBranchId;

const SEMESTER_END = "2026-12-20";
const YEAR_END = "2027-07-01";

test.group("branch_service", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("createBranch stores the general fields and returns a branch with empty period lists", async ({
    assert,
  }) => {
    const branch = await createBranchThroughService({
      name: "Flåklypa vgs",
      region: "Flåklypa",
      parentBranchId: null,
    });
    assert.equal(branch.name, "Flåklypa vgs");
    assert.isNull(branch.address);
    assert.equal(branch.visibility, "employee");
    assert.deepEqual(branch.rentPeriods, []);
  });

  test("updateBranch changes only the columns sent", async ({ assert }) => {
    const branch = await createBranch({ name: "Ullern", paymentResponsible: false });
    const updated = await updateBranch(branch.id, { paymentResponsible: true, address: "Vei 1" });
    assert.isTrue(updated.paymentResponsible);
    assert.equal(updated.address, "Vei 1");
    assert.equal(updated.name, "Ullern");
  });

  test("a period list that is sent replaces that kind wholesale and leaves the other kinds alone", async ({
    assert,
  }) => {
    const branch = await createBranch({
      rentPeriods: [{ type: "year", date: YEAR_END, maxNumberOfPeriods: 1, percentage: 1 }],
      extendPeriods: [
        {
          type: "semester",
          date: SEMESTER_END,
          maxNumberOfPeriods: 1,
          price: 50,
          percentage: null,
        },
      ],
    });
    const updated = await updateBranch(branch.id, {
      rentPeriods: [
        { type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 1, percentage: 0.5 },
        { type: "year", date: YEAR_END, maxNumberOfPeriods: 1, percentage: 1 },
      ],
    });
    assert.deepEqual(
      updated.rentPeriods.map((period) => [period.type, period.percentage]),
      [
        ["semester", 0.5],
        ["year", 1],
      ],
    );
    assert.lengthOf(updated.extendPeriods, 1);
    assert.equal(
      await BranchPeriod.query()
        .where("branch_id", branch.id)
        .count("* as total")
        .first()
        .then((row) => Number(row?.$extras["total"])),
      3,
    );

    const cleared = await updateBranch(branch.id, { extendPeriods: [] });
    assert.deepEqual(cleared.extendPeriods, []);
    assert.lengthOf(cleared.rentPeriods, 2);
  });

  test("updateBranchRelationships moves the branch and re-parents the listed children", async ({
    assert,
  }) => {
    const school = await createBranch({ name: "Ullern" });
    const otherSchool = await createBranch({ name: "Persbråten" });
    const vg1 = await createBranch({ name: "VG1", parentBranchId: school.id });
    const vg2 = await createBranch({ name: "VG2", parentBranchId: school.id });
    const stray = await createBranch({ name: "Stray", parentBranchId: otherSchool.id });

    const updated = await updateBranchRelationships({
      id: school.id,
      localName: "Ullern",
      childLabel: "årskull",
      parentBranchId: null,
      childBranchIds: [vg1.id, stray.id],
    });
    assert.equal(updated.localName, "Ullern");
    assert.equal(updated.childLabel, "årskull");
    assert.isNull(updated.parentBranchId);

    assert.equal(await parentOf(vg1.id), school.id);
    assert.equal(await parentOf(stray.id), school.id);
    assert.isNull(await parentOf(vg2.id));

    // Absent lists leave the tree alone.
    await updateBranchRelationships({ id: school.id, parentBranchId: otherSchool.id });
    assert.equal(await parentOf(school.id), otherSchool.id);
    assert.equal(await parentOf(vg1.id), school.id);
  });

  test("a branch can neither be its own ancestor nor adopt one", async ({ assert }) => {
    const school = await createBranch({ name: "Ullern" });
    const vg1 = await createBranch({ name: "VG1", parentBranchId: school.id });
    const vg1st = await createBranch({ name: "VG1 ST", parentBranchId: vg1.id });

    await assert.rejects(
      () => updateBranchRelationships({ id: school.id, parentBranchId: school.id }),
      BranchCycleError,
    );
    await assert.rejects(
      () => updateBranchRelationships({ id: school.id, parentBranchId: vg1st.id }),
      BranchCycleError,
    );
    await assert.rejects(
      () => updateBranchRelationships({ id: vg1st.id, childBranchIds: [school.id] }),
      BranchCycleError,
    );
    await assert.rejects(
      () => updateBranchRelationships({ id: vg1.id, childBranchIds: [vg1.id] }),
      BranchCycleError,
    );
    // Nothing was written by the refused updates.
    assert.isNull((await Branch.findOrFail(school.id)).parentBranchId);
    assert.equal((await Branch.findOrFail(vg1st.id)).parentBranchId, vg1.id);
  });
});

/** Sonans → Sonans Oslo → Sonans Oslo kveld, plus Sonans Bergen; every campus inherits from Sonans. */
async function sonansTree() {
  const sonans = await createBranch({ name: "Sonans", visibility: "employee" });
  const oslo = await createBranch({ name: "Sonans Oslo", parentBranchId: sonans.id });
  const kveld = await createBranch({ name: "Sonans Oslo kveld", parentBranchId: oslo.id });
  const bergen = await createBranch({ name: "Sonans Bergen", parentBranchId: sonans.id });
  return { sonans, oslo, kveld, bergen };
}

const overrideOf = async (id: string) => (await Branch.findOrFail(id)).overrides.visibility;

test.group("branch_service inheritance", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a branch that inherits stores null and follows every change above", async ({ assert }) => {
    const { sonans, oslo, kveld } = await sonansTree();
    assert.isNull(await overrideOf(kveld.id));

    await updateBranch(sonans.id, { visibility: "admin" });
    assert.equal(await visibilityOf(oslo.id), "admin");
    assert.equal(await visibilityOf(kveld.id), "admin");
    assert.isNull(await overrideOf(kveld.id));
  });

  test("an override stays through changes above, and only its subtree follows it", async ({
    assert,
  }) => {
    const { sonans, oslo, kveld, bergen } = await sonansTree();
    await updateBranch(oslo.id, { visibility: "public" });
    assert.equal(await overrideOf(oslo.id), "public");
    assert.equal(await visibilityOf(kveld.id), "public");
    assert.equal(await visibilityOf(bergen.id), "employee");

    await updateBranch(sonans.id, { visibility: "admin" });
    assert.equal(await visibilityOf(oslo.id), "public");
    assert.equal(await visibilityOf(kveld.id), "public");
    assert.equal(await visibilityOf(bergen.id), "admin");
  });

  test("a value equal to the parent's is an override too, and null inherits again", async ({
    assert,
  }) => {
    const { sonans, oslo, kveld } = await sonansTree();
    await updateBranch(oslo.id, { visibility: "employee" });
    assert.equal(await overrideOf(oslo.id), "employee");

    // The override holds the value whatever changes above.
    await updateBranch(sonans.id, { visibility: "admin" });
    assert.equal(await visibilityOf(oslo.id), "employee");
    assert.equal(await visibilityOf(kveld.id), "employee");

    await updateBranch(oslo.id, { visibility: null });
    assert.isNull(await overrideOf(oslo.id));
    assert.equal(await visibilityOf(kveld.id), "admin");
  });

  test("a change above never touches an override below, even one it comes to equal", async ({
    assert,
  }) => {
    const { sonans, oslo } = await sonansTree();
    await updateBranch(oslo.id, { visibility: "public" });

    await updateBranch(sonans.id, { visibility: "public" });
    await updateBranch(sonans.id, { visibility: "admin" });
    assert.equal(await overrideOf(oslo.id), "public");
    assert.equal(await visibilityOf(oslo.id), "public");
  });

  test("a root cannot inherit", async ({ assert }) => {
    const { sonans } = await sonansTree();
    await assert.rejects(() => updateBranch(sonans.id, { visibility: null }), /arve/);
  });

  test("every inherited field resolves the same way", async ({ assert }) => {
    const fields = [
      ["deliveryAtBranch", false],
      ["deliveryByMail", false],
      ["paymentResponsible", true],
      ["responsibleForDelivery", true],
      ["buyoutPercentage", 0.33],
      ["sellPercentage", 0.5],
    ] as const;
    const { sonans, oslo, kveld, bergen } = await sonansTree();
    await updateBranch(bergen.id, { visibility: "public" });

    for (const [field, value] of fields) {
      await updateBranch(sonans.id, { [field]: value, visibility: "employee" });
      const [child, grandchild, sibling] = await Promise.all(
        [oslo.id, kveld.id, bergen.id].map((id) => Branch.findOrFail(id)),
      );
      assert.equal(child?.[field], value, field);
      assert.equal(grandchild?.[field], value, field);
      assert.isNull(grandchild?.overrides[field], field);
      assert.equal(sibling?.[field], value, field);
      assert.equal(sibling?.visibility, "public");
    }
  });

  test("a moved branch inherits from its new parent and keeps its overrides", async ({
    assert,
  }) => {
    const wang = await createBranch({ name: "Wang", visibility: "admin", deliveryByMail: false });
    const { oslo, kveld } = await sonansTree();
    await updateBranch(oslo.id, { deliveryByMail: false, buyoutPercentage: 0.5 });

    await updateBranchRelationships({ id: oslo.id, parentBranchId: wang.id });
    const moved = await Branch.findOrFail(oslo.id);
    assert.equal(moved.visibility, "admin");
    assert.equal(await visibilityOf(kveld.id), "admin");
    // Equal to Wang's value, but still Oslo's own.
    assert.isFalse(moved.overrides.deliveryByMail);
    assert.equal(moved.overrides.buyoutPercentage, 0.5);
  });

  test("a branch that becomes a root keeps the values it had as its own", async ({ assert }) => {
    const { sonans, oslo, kveld } = await sonansTree();
    await updateBranch(sonans.id, { buyoutPercentage: 0.33 });

    await updateBranchRelationships({ id: oslo.id, parentBranchId: null });
    const root = await Branch.findOrFail(oslo.id);
    assert.equal(root.overrides.visibility, "employee");
    assert.equal(root.overrides.buyoutPercentage, 0.33);
    assert.isNull(await overrideOf(kveld.id));

    // Children dropped from the list become roots the same way.
    await updateBranchRelationships({ id: oslo.id, childBranchIds: [] });
    assert.equal(await overrideOf(kveld.id), "employee");
  });

  test("a branch created under a parent inherits everything", async ({ assert }) => {
    const sonans = await createBranch({
      name: "Sonans",
      visibility: "admin",
      deliveryByMail: false,
      buyoutPercentage: 0.33,
    });
    const created = await createBranchThroughService({
      name: "Sonans Ski",
      region: "Ski",
      parentBranchId: sonans.id,
    });
    assert.equal(created.parentBranchId, sonans.id);
    assert.equal(created.visibility, "admin");
    assert.isFalse(created.deliveryByMail);
    assert.equal(created.buyoutPercentage, 0.33);
    assert.isTrue(Object.values(created.overrides).every((value) => value === null));
  });

  test("a branch created as a root holds the root values", async ({ assert }) => {
    const created = await createBranchThroughService({
      name: "Bokflyt.no AS",
      region: "Norge",
      parentBranchId: null,
    });
    assert.isNull(created.parentBranchId);
    assert.equal(created.overrides.visibility, "employee");
    assert.isTrue(created.overrides.deliveryAtBranch);
  });

  test("inheritBelow clears every override below, and nothing else changes", async ({ assert }) => {
    const wang = await createBranch({ name: "Wang", visibility: "admin" });
    const { sonans, oslo, kveld, bergen } = await sonansTree();
    await updateBranch(oslo.id, { visibility: "public" });
    await updateBranch(kveld.id, { visibility: "admin" });

    await inheritBelow(oslo.id, "visibility");
    assert.equal(await overrideOf(oslo.id), "public");
    assert.isNull(await overrideOf(kveld.id));
    assert.equal(await visibilityOf(kveld.id), "public");

    await inheritBelow(sonans.id, "visibility");
    assert.isNull(await overrideOf(oslo.id));
    assert.equal(await visibilityOf(kveld.id), "employee");
    assert.equal(await visibilityOf(bergen.id), "employee");
    assert.equal(await visibilityOf(wang.id), "admin");
  });
});
