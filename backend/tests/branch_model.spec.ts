import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import Branch from "#models/branch";
import BranchPeriod from "#models/branch_period";
import { isObjectIdHex } from "#models/helpers/object_id";
import { createBranch } from "#tests/branch_fixtures";
import { fixtureId } from "#tests/fixtures";

const SEMESTER_END = new Date("2026-12-20T00:00:00.000Z");
const YEAR_END = new Date("2027-07-01T00:00:00.000Z");

test.group("Branch model", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("a new branch gets an ObjectId-shaped primary key", async ({ assert }) => {
    const branch = await createBranch({ id: "" });
    assert.isTrue(isObjectIdHex(branch.id));
    assert.equal((await Branch.findOrFail(branch.id)).id, branch.id);
  });

  test("every read carries the periods as three typed lists, in saved order", async ({
    assert,
  }) => {
    const created = await createBranch({
      rentPeriods: [
        { type: "year", date: YEAR_END, maxNumberOfPeriods: 1, percentage: 1 },
        { type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 2, percentage: 0.5 },
      ],
      extendPeriods: [
        {
          type: "semester",
          date: SEMESTER_END,
          maxNumberOfPeriods: 1,
          price: 50,
          percentage: null,
        },
      ],
      partlyPaymentPeriods: [
        {
          type: "semester",
          date: SEMESTER_END,
          percentageBuyout: 0.33,
          percentageUpFront: 0.6,
        },
      ],
    });

    for (const branch of [
      await Branch.findOrFail(created.id),
      ...(await Branch.findMany([created.id])),
      ...(await Branch.all()),
      ...(await Branch.query().where("id", created.id)),
    ]) {
      assert.deepEqual(branch.rentPeriods, [
        { type: "year", date: YEAR_END, maxNumberOfPeriods: 1, percentage: 1 },
        { type: "semester", date: SEMESTER_END, maxNumberOfPeriods: 2, percentage: 0.5 },
      ]);
      assert.deepEqual(branch.extendPeriods, [
        {
          type: "semester",
          date: SEMESTER_END,
          maxNumberOfPeriods: 1,
          price: 50,
          percentage: null,
        },
      ]);
      assert.deepEqual(branch.partlyPaymentPeriods, [
        {
          type: "semester",
          date: SEMESTER_END,
          percentageBuyout: 0.33,
          percentageUpFront: 0.6,
        },
      ]);
    }
  });

  test("a branch created without loading its periods refuses to guess them", async ({ assert }) => {
    const branch = await Branch.create({ name: "Ny", region: "Oslo" });
    assert.throws(() => branch.rentPeriods, /periods were not loaded/);
    await branch.load("periods");
    assert.deepEqual(branch.rentPeriods, []);
  });

  test("a period row missing a column its kind needs is a bug, not a default", async ({
    assert,
  }) => {
    const branch = await createBranch();
    await BranchPeriod.create({
      branchId: branch.id,
      kind: "rent",
      periodType: "year",
      date: DateTime.fromJSDate(YEAR_END),
      maxNumberOfPeriods: 1,
      percentage: null,
    });
    const reloaded = await Branch.findOrFail(branch.id);
    assert.throws(() => reloaded.rentPeriods, /percentage is null/);
  });

  test("allByName sorts Norwegian letters after Z, publicByName hides inactive and offline branches", async ({
    assert,
  }) => {
    await createBranch({ name: "Østfold" });
    await createBranch({ name: "Wang", active: false });
    await createBranch({ name: "Akademiet", branchItemsLiveOnline: false });
    await createBranch({ name: "Bjørknes" });
    assert.deepEqual(
      (await Branch.allByName()).map((branch) => branch.name),
      ["Akademiet", "Bjørknes", "Wang", "Østfold"],
    );
    assert.deepEqual(
      (await Branch.publicByName()).map((branch) => branch.name),
      ["Bjørknes", "Østfold"],
    );
  });

  test("byIds and namesByIds skip ids that do not exist", async ({ assert }) => {
    const branch = await createBranch({ name: "Ullern" });
    const names = await Branch.namesByIds([branch.id, fixtureId("dead"), null, undefined]);
    assert.deepEqual([...names], [[branch.id, "Ullern"]]);
    assert.deepEqual([...(await Branch.byIds([]))], []);
    assert.isNull(await Branch.findOptional(undefined));
    await assert.rejects(() => Branch.getOrFail(fixtureId("dead")), /Fant ikke filial/);
  });

  test("descendants walk the whole tree and leafDescendants stop at the classes", async ({
    assert,
  }) => {
    const school = await createBranch({ name: "Ullern" });
    const vg1 = await createBranch({ name: "Ullern VG1", parentBranchId: school.id });
    const vg2 = await createBranch({ name: "Ullern VG2", parentBranchId: school.id });
    const vg1st = await createBranch({ name: "Ullern VG1 ST", parentBranchId: vg1.id });
    const vg1ma = await createBranch({ name: "Ullern VG1 MA", parentBranchId: vg1.id });
    await createBranch({ name: "Persbråten" });

    assert.sameMembers(await Branch.descendantIds(school.id), [vg1.id, vg2.id, vg1st.id, vg1ma.id]);
    assert.deepEqual(
      (await Branch.leafDescendants(school.id)).map((branch) => branch.name),
      ["Ullern VG1 MA", "Ullern VG1 ST", "Ullern VG2"],
    );
    assert.deepEqual(await Branch.descendantIds(vg1st.id), []);
    assert.deepEqual(await Branch.leafDescendants(vg1st.id), []);
  });
});
