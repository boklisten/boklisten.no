import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import { DateTime } from "luxon";

import Branch from "#models/branch";
import BranchPeriod from "#models/branch_period";
import { isObjectIdHex } from "#models/helpers/object_id";
import { ROOT_VALUES, overrideColumns } from "#services/branch_inheritance_service";
import { BranchSubjectsService } from "#services/branch_subjects_service";
import type { UserPermission } from "#shared/user-permission";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";
import { fixtureId } from "#tests/fixtures";

const SEMESTER_END = "2026-12-20";
const YEAR_END = "2027-07-01";

async function visibleNames(permission: UserPermission | null) {
  return (await Branch.visibleByName(permission)).map((branch) => branch.name);
}

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
    const branch = await Branch.create({
      name: "Ny",
      ...overrideColumns(ROOT_VALUES),
    });
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
      date: DateTime.fromISO(YEAR_END),
      maxNumberOfPeriods: 1,
      percentage: null,
    });
    const reloaded = await Branch.findOrFail(branch.id);
    assert.throws(() => reloaded.rentPeriods, /percentage is null/);
  });

  test("visibleByName shows each viewer what their permission allows, Norwegian letters after Z", async ({
    assert,
  }) => {
    await createBranch({ name: "Østfold" });
    await createBranch({ name: "Wang", visibility: "admin" });
    await createBranch({ name: "Akademiet", visibility: "employee" });
    await createBranch({ name: "Bjørknes" });

    assert.deepEqual(await visibleNames(null), ["Bjørknes", "Østfold"]);
    assert.deepEqual(await visibleNames("customer"), ["Bjørknes", "Østfold"]);
    assert.deepEqual(await visibleNames("employee"), ["Akademiet", "Bjørknes", "Østfold"]);
    assert.deepEqual(await visibleNames("admin"), ["Akademiet", "Bjørknes", "Wang", "Østfold"]);
  });

  test("publicTree keeps the public branches that lead to books, hidden levels skipped", async ({
    assert,
  }) => {
    const item = await createItem();
    const book = { itemId: item.id, rent: true, partlyPayment: false, buy: false };
    const atBranch = { rentAtBranch: true, partlyPaymentAtBranch: false, buyAtBranch: false };
    const withBooks = async (branch: Branch) =>
      BranchSubjectsService.create(branch.id, {
        name: "Kjemi 2",
        externalName: null,
        books: [{ ...book, ...atBranch }],
      });

    const root = await createBranch({
      name: "Boklisten.no AS",
      visibility: "admin",
      childLabel: "skoletype",
    });
    const vgs = await createBranch({ name: "VGS", parentBranchId: root.id, visibility: "public" });
    const ullern = await createBranch({
      name: "Ullern",
      parentBranchId: vgs.id,
      childLabel: "årskull",
      localName: "Ullern",
    });
    const vg1 = await createBranch({
      name: "Ullern VG1",
      parentBranchId: ullern.id,
      localName: "VG1",
    });
    await withBooks(vg1);
    // Books below a hidden level are reached through the hidden level's parent.
    const staff = await createBranch({
      name: "Ullern Ansatte",
      parentBranchId: ullern.id,
      visibility: "admin",
    });
    const teachers = await createBranch({
      name: "Ullern Lærer",
      parentBranchId: staff.id,
      visibility: "public",
    });
    await withBooks(teachers);
    // No books anywhere below: pruned, together with its empty subject.
    const empty = await createBranch({ name: "Oslo innsamling", parentBranchId: vgs.id });
    await BranchSubjectsService.create(empty.id, { name: "Gym", externalName: null, books: [] });
    // Books, but not public: pruned, and so is its parent, which then leads nowhere.
    const metis = await createBranch({ name: "Metis", parentBranchId: vgs.id });
    const metisOslo = await createBranch({
      name: "Metis Oslo",
      parentBranchId: metis.id,
      visibility: "employee",
    });
    await withBooks(metisOslo);

    const tree = await Branch.publicTree();
    assert.equal(tree.topLabel, "skoletype");
    assert.deepEqual(
      tree.nodes.map(({ name, parentBranchId, hasBooks }) => ({ name, parentBranchId, hasBooks })),
      [
        { name: "Ullern", parentBranchId: vgs.id, hasBooks: false },
        { name: "Ullern Lærer", parentBranchId: ullern.id, hasBooks: true },
        { name: "Ullern VG1", parentBranchId: ullern.id, hasBooks: true },
        { name: "VGS", parentBranchId: null, hasBooks: false },
      ],
    );
    assert.deepEqual(
      tree.nodes.find((node) => node.name === "Ullern"),
      {
        id: ullern.id,
        name: "Ullern",
        localName: "Ullern",
        parentBranchId: vgs.id,
        childLabel: "årskull",
        hasBooks: false,
      },
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
