import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import Branch from "#models/branch";
import BranchPeriod from "#models/branch_period";
import { inheritBelow } from "#services/branch_inheritance_service";
import {
  BranchCycleError,
  assertNotRoot,
  createBranch as createBranchThroughService,
  updateBranch,
  updateBranchRelationships,
} from "#services/branch_service";
import { createBranch, rootBranch } from "#tests/branch_fixtures";

const visibleOf = async (id: string) => (await Branch.findOrFail(id)).visibleToCustomers;

const parentOf = async (id: string) => (await Branch.findOrFail(id)).parentBranchId;

const SEMESTER_END = "2026-12-20";
const YEAR_END = "2027-07-01";

test.group("branch_service", (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction());

  test("createBranch stores the general fields and returns a branch with empty period lists", async ({
    assert,
  }) => {
    const branch = await createBranchThroughService({
      name: "Flåklypa vgs",
      parentBranchId: (await rootBranch()).id,
    });
    assert.equal(branch.name, "Flåklypa vgs");
    assert.isNull(branch.address);
    assert.isFalse(branch.visibleToCustomers);
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
      childBranchIds: [vg1.id, vg2.id, stray.id],
    });
    assert.equal(updated.localName, "Ullern");
    assert.equal(updated.childLabel, "årskull");
    assert.equal(updated.parentBranchId, (await rootBranch()).id);

    assert.equal(await parentOf(vg1.id), school.id);
    assert.equal(await parentOf(vg2.id), school.id);
    assert.equal(await parentOf(stray.id), school.id);

    // Absent lists leave the tree alone; a listed branch leaves its old parent.
    await updateBranchRelationships({ id: otherSchool.id, childBranchIds: [school.id] });
    assert.equal(await parentOf(school.id), otherSchool.id);
    assert.equal(await parentOf(vg1.id), school.id);
  });

  test("a branch can neither be its own ancestor nor adopt one", async ({ assert }) => {
    const school = await createBranch({ name: "Ullern" });
    const vg1 = await createBranch({ name: "VG1", parentBranchId: school.id });
    const vg1st = await createBranch({ name: "VG1 ST", parentBranchId: vg1.id });

    await assert.rejects(
      () => updateBranchRelationships({ id: vg1st.id, childBranchIds: [vg1st.id] }),
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
    assert.equal((await Branch.findOrFail(school.id)).parentBranchId, (await rootBranch()).id);
    assert.equal((await Branch.findOrFail(vg1st.id)).parentBranchId, vg1.id);
  });
});

/** Sonans → Sonans Oslo → Sonans Oslo kveld, plus Sonans Bergen; every campus inherits from Sonans. */
async function sonansTree() {
  const sonans = await createBranch({ name: "Sonans", visibleToCustomers: false });
  const oslo = await createBranch({ name: "Sonans Oslo", parentBranchId: sonans.id });
  const kveld = await createBranch({ name: "Sonans Oslo kveld", parentBranchId: oslo.id });
  const bergen = await createBranch({ name: "Sonans Bergen", parentBranchId: sonans.id });
  return { sonans, oslo, kveld, bergen };
}

const overrideOf = async (id: string) => (await Branch.findOrFail(id)).overrides.visibleToCustomers;

test.group("branch_service inheritance", (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction());

  test("a branch that inherits stores null and follows every change above", async ({ assert }) => {
    const { sonans, oslo, kveld } = await sonansTree();
    assert.isNull(await overrideOf(kveld.id));

    await updateBranch(sonans.id, { visibleToCustomers: true });
    assert.isTrue(await visibleOf(oslo.id));
    assert.isTrue(await visibleOf(kveld.id));
    assert.isNull(await overrideOf(kveld.id));
  });

  test("an override stays through changes above, and only its subtree follows it", async ({
    assert,
  }) => {
    const { sonans, oslo, kveld, bergen } = await sonansTree();
    await updateBranch(oslo.id, { visibleToCustomers: true });
    assert.isTrue(await overrideOf(oslo.id));
    assert.isTrue(await visibleOf(kveld.id));
    assert.isFalse(await visibleOf(bergen.id));

    await updateBranch(sonans.id, { visibleToCustomers: true });
    await updateBranch(oslo.id, { visibleToCustomers: false });
    assert.isFalse(await visibleOf(oslo.id));
    assert.isFalse(await visibleOf(kveld.id));
    assert.isTrue(await visibleOf(bergen.id));
  });

  test("a value equal to the parent's is an override too, and null inherits again", async ({
    assert,
  }) => {
    const { sonans, oslo, kveld } = await sonansTree();
    await updateBranch(oslo.id, { visibleToCustomers: false });
    assert.isFalse(await overrideOf(oslo.id));

    // The override holds the value whatever changes above.
    await updateBranch(sonans.id, { visibleToCustomers: true });
    assert.isFalse(await visibleOf(oslo.id));
    assert.isFalse(await visibleOf(kveld.id));

    await updateBranch(oslo.id, { visibleToCustomers: null });
    assert.isNull(await overrideOf(oslo.id));
    assert.isTrue(await visibleOf(kveld.id));
  });

  test("a change above never touches an override below, even one it comes to equal", async ({
    assert,
  }) => {
    const { sonans, oslo } = await sonansTree();
    await updateBranch(oslo.id, { visibleToCustomers: true });

    await updateBranch(sonans.id, { visibleToCustomers: true });
    await updateBranch(sonans.id, { visibleToCustomers: false });
    assert.isTrue(await overrideOf(oslo.id));
    assert.isTrue(await visibleOf(oslo.id));
  });

  test("the root cannot inherit", async ({ assert }) => {
    const root = await rootBranch();
    await assert.rejects(() => updateBranch(root.id, { visibleToCustomers: null }), /arve/);
  });

  test("the root cannot be made visible to customers", async ({ assert }) => {
    const root = await rootBranch();
    await assert.rejects(() => updateBranch(root.id, { visibleToCustomers: true }), /synlig/);
    assert.isFalse((await Branch.findOrFail(root.id)).visibleToCustomers);
    // Its other fields can still be set.
    assert.equal((await updateBranch(root.id, { buyoutPercentage: 0.5 })).buyoutPercentage, 0.5);
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
    await updateBranch(bergen.id, { visibleToCustomers: true });

    for (const [field, value] of fields) {
      await updateBranch(sonans.id, { [field]: value, visibleToCustomers: false });
      const [child, grandchild, sibling] = await Promise.all(
        [oslo.id, kveld.id, bergen.id].map((id) => Branch.findOrFail(id)),
      );
      assert.equal(child?.[field], value, field);
      assert.equal(grandchild?.[field], value, field);
      assert.isNull(grandchild?.overrides[field], field);
      assert.equal(sibling?.[field], value, field);
      assert.isTrue(sibling?.visibleToCustomers);
    }
  });

  test("a moved branch inherits from its new parent and keeps its overrides", async ({
    assert,
  }) => {
    const wang = await createBranch({
      name: "Wang",
      visibleToCustomers: true,
      deliveryByMail: false,
    });
    const { oslo, kveld } = await sonansTree();
    await updateBranch(oslo.id, { deliveryByMail: false, buyoutPercentage: 0.5 });

    await updateBranchRelationships({ id: wang.id, childBranchIds: [oslo.id] });
    const moved = await Branch.findOrFail(oslo.id);
    assert.isTrue(moved.visibleToCustomers);
    assert.isTrue(await visibleOf(kveld.id));
    // Equal to Wang's value, but still Oslo's own.
    assert.isFalse(moved.overrides.deliveryByMail);
    assert.equal(moved.overrides.buyoutPercentage, 0.5);
  });

  test("the root stays where it is and no branch can be detached from the tree", async ({
    assert,
  }) => {
    const root = await rootBranch();
    const { sonans, oslo, kveld } = await sonansTree();

    await assert.rejects(
      () => updateBranchRelationships({ id: sonans.id, childBranchIds: [root.id] }),
      BranchCycleError,
    );
    // Dropping a child from the list would leave it without a parent.
    await assert.rejects(
      () => updateBranchRelationships({ id: oslo.id, childBranchIds: [] }),
      /løsrives/,
    );
    assert.isNull(await parentOf(root.id));
    assert.equal(await parentOf(kveld.id), oslo.id);
    // The root's own columns can still be edited.
    const renamed = await updateBranchRelationships({ id: root.id, childLabel: "selskap" });
    assert.equal(renamed.childLabel, "selskap");
    assert.isNull(renamed.parentBranchId);
  });

  test("assertNotRoot refuses the root and accepts any other branch", async ({ assert }) => {
    const root = await rootBranch();
    const { oslo } = await sonansTree();
    await assert.rejects(() => assertNotRoot(root.id), /Alle filialer/);
    await assertNotRoot(oslo.id);
  });

  test("a branch created under a parent inherits everything", async ({ assert }) => {
    const sonans = await createBranch({
      name: "Sonans",
      visibleToCustomers: false,
      deliveryByMail: false,
      buyoutPercentage: 0.33,
    });
    const created = await createBranchThroughService({
      name: "Sonans Ski",
      parentBranchId: sonans.id,
    });
    assert.equal(created.parentBranchId, sonans.id);
    assert.isFalse(created.visibleToCustomers);
    assert.isFalse(created.deliveryByMail);
    assert.equal(created.buyoutPercentage, 0.33);
    assert.isTrue(Object.values(created.overrides).every((value) => value === null));
  });

  test("inheritBelow clears every override below, and nothing else changes", async ({ assert }) => {
    const wang = await createBranch({ name: "Wang", visibleToCustomers: true });
    const { sonans, oslo, kveld, bergen } = await sonansTree();
    await updateBranch(oslo.id, { visibleToCustomers: true });
    await updateBranch(kveld.id, { visibleToCustomers: false });

    await inheritBelow(oslo.id, "visibleToCustomers");
    assert.isTrue(await overrideOf(oslo.id));
    assert.isNull(await overrideOf(kveld.id));
    assert.isTrue(await visibleOf(kveld.id));

    await inheritBelow(sonans.id, "visibleToCustomers");
    assert.isNull(await overrideOf(oslo.id));
    assert.isFalse(await visibleOf(kveld.id));
    assert.isFalse(await visibleOf(bergen.id));
    assert.isTrue(await visibleOf(wang.id));
  });
});
