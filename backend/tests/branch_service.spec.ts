import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import Branch from "#models/branch";
import BranchPeriod from "#models/branch_period";
import {
  BranchCycleError,
  createBranch as createBranchThroughService,
  updateBranch,
  updateBranchRelationships,
} from "#services/branch_service";
import { createBranch } from "#tests/branch_fixtures";

const parentOf = async (id: string) => (await Branch.findOrFail(id)).parentBranchId;

const SEMESTER_END = new Date("2026-12-20T00:00:00.000Z");
const YEAR_END = new Date("2027-07-01T00:00:00.000Z");

test.group("branch_service", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("createBranch stores the general fields and returns a branch with empty period lists", async ({
    assert,
  }) => {
    const branch = await createBranchThroughService({
      name: "Flåklypa vgs",
      region: "Flåklypa",
      type: "VGS",
    });
    assert.equal(branch.name, "Flåklypa vgs");
    assert.equal(branch.type, "VGS");
    assert.isNull(branch.logo);
    assert.isNull(branch.address);
    assert.isTrue(branch.active);
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
