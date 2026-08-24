import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";
import sinon, { createSandbox } from "sinon";

import BranchSubject from "#models/branch_subject";
import BranchSubjectBook from "#models/branch_subject_book";
import { BranchSubjectsService, fetchSubjectsForUpload } from "#services/branch_subjects_service";
import { StorageService } from "#services/storage_service";

const BRANCH = "5d765db5fc8c47001c408d81";
const OTHER_BRANCH = "5d765db5fc8c47001c408d82";
const ITEM_KJEMI = "6100000000000000000000a1";
const ITEM_FYSIKK = "6100000000000000000000a2";

const ALL_OFF = {
  rent: false,
  partlyPayment: false,
  buy: false,
  rentAtBranch: false,
  partlyPaymentAtBranch: false,
  buyAtBranch: false,
};

test.group("BranchSubjectsService", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(() => {
    sandbox = createSandbox();
  });
  group.each.teardown(() => sandbox.restore());

  function stubItemTitles(titles: Record<string, string>) {
    sandbox
      .stub(StorageService.Items, "aggregate")
      .resolves(Object.entries(titles).map(([id, title]) => ({ id, title })) as never);
  }

  test("creates a subject with books and lists it with item titles", async ({ assert }) => {
    stubItemTitles({ [ITEM_KJEMI]: "Kjemien stemmer" });
    await BranchSubjectsService.create(BRANCH, {
      name: "Kjemi 2",
      externalName: "Kjemi 2 programfag",
      books: [{ itemId: ITEM_KJEMI, ...ALL_OFF, rent: true }],
    });

    const subjects = await BranchSubjectsService.list(BRANCH);
    assert.lengthOf(subjects, 1);
    assert.equal(subjects[0]?.name, "Kjemi 2");
    assert.equal(subjects[0]?.externalName, "Kjemi 2 programfag");
    assert.deepEqual(subjects[0]?.books, [
      { item: { id: ITEM_KJEMI, title: "Kjemien stemmer" }, ...ALL_OFF, rent: true },
    ]);
  });

  test("allows a subject with no books", async ({ assert }) => {
    stubItemTitles({});
    await BranchSubjectsService.create(BRANCH, {
      name: "Gym",
      externalName: "Kroppsøving",
      books: [],
    });
    const subjects = await BranchSubjectsService.list(BRANCH);
    assert.deepEqual(subjects[0]?.books, []);
  });

  test("rejects a duplicate name even with different casing and spacing", async ({ assert }) => {
    await BranchSubjectsService.create(BRANCH, { name: "Kjemi 2", externalName: "K2", books: [] });
    await assert.rejects(
      () =>
        BranchSubjectsService.create(BRANCH, { name: " kjemi2 ", externalName: "X", books: [] }),
      /finnes allerede et fag med navnet/,
    );
  });

  test("rejects a duplicate external name within the branch", async ({ assert }) => {
    await BranchSubjectsService.create(BRANCH, { name: "Kjemi 2", externalName: "K2", books: [] });
    await assert.rejects(
      () => BranchSubjectsService.create(BRANCH, { name: "Annet", externalName: "k 2", books: [] }),
      /finnes allerede et fag med det eksterne navnet/,
    );
  });

  test("allows the same names on different branches", async ({ assert }) => {
    await BranchSubjectsService.create(BRANCH, { name: "Kjemi 2", externalName: "K2", books: [] });
    await assert.doesNotReject(() =>
      BranchSubjectsService.create(OTHER_BRANCH, {
        name: "Kjemi 2",
        externalName: "K2",
        books: [],
      }),
    );
  });

  test("rejects the same book twice in one subject", async ({ assert }) => {
    await assert.rejects(
      () =>
        BranchSubjectsService.create(BRANCH, {
          name: "Kjemi 2",
          externalName: "K2",
          books: [
            { itemId: ITEM_KJEMI, ...ALL_OFF },
            { itemId: ITEM_KJEMI, ...ALL_OFF, buy: true },
          ],
        }),
      /Samme bok/,
    );
  });

  test("update replaces the book list and keeps the subject's own names valid", async ({
    assert,
  }) => {
    stubItemTitles({ [ITEM_FYSIKK]: "Fysikkboka" });
    await BranchSubjectsService.create(BRANCH, {
      name: "Kjemi 2",
      externalName: "K2",
      books: [{ itemId: ITEM_KJEMI, ...ALL_OFF, rent: true }],
    });
    const [subject] = await BranchSubject.query().where("branchId", BRANCH);

    await BranchSubjectsService.update(BRANCH, subject!.id, {
      name: "Kjemi 2",
      externalName: "Kjemi 2 programfag",
      books: [{ itemId: ITEM_FYSIKK, ...ALL_OFF, buyAtBranch: true }],
    });

    const subjects = await BranchSubjectsService.list(BRANCH);
    assert.equal(subjects[0]?.externalName, "Kjemi 2 programfag");
    assert.deepEqual(subjects[0]?.books, [
      { item: { id: ITEM_FYSIKK, title: "Fysikkboka" }, ...ALL_OFF, buyAtBranch: true },
    ]);
  });

  test("update refuses a subject belonging to another branch", async ({ assert }) => {
    await BranchSubjectsService.create(BRANCH, { name: "Kjemi 2", externalName: "K2", books: [] });
    const [subject] = await BranchSubject.query().where("branchId", BRANCH);
    await assert.rejects(
      () =>
        BranchSubjectsService.update(OTHER_BRANCH, subject!.id, {
          name: "X",
          externalName: "X",
          books: [],
        }),
      /Fant ikke faget/,
    );
  });

  test("destroy removes the subject and its books", async ({ assert }) => {
    await BranchSubjectsService.create(BRANCH, {
      name: "Kjemi 2",
      externalName: "K2",
      books: [{ itemId: ITEM_KJEMI, ...ALL_OFF }],
    });
    const [subject] = await BranchSubject.query().where("branchId", BRANCH);

    await BranchSubjectsService.destroy(BRANCH, subject!.id);

    assert.lengthOf(await BranchSubject.all(), 0);
    assert.lengthOf(await BranchSubjectBook.all(), 0);
  });

  test("import creates one subject per category with the books' options copied", async ({
    assert,
  }) => {
    sandbox.stub(StorageService.BranchItems, "aggregate").resolves([
      {
        itemId: ITEM_KJEMI,
        categories: ["Kjemi 2", "Realfag"],
        ...ALL_OFF,
        rent: true,
      },
      { itemId: ITEM_FYSIKK, categories: ["Realfag"], ...ALL_OFF, buy: true },
    ] as never);
    stubItemTitles({ [ITEM_KJEMI]: "Kjemien stemmer", [ITEM_FYSIKK]: "Fysikkboka" });

    const result = await BranchSubjectsService.importFromBranchItems(BRANCH);

    assert.deepEqual(result, { createdSubjects: 2, skippedExisting: 0 });
    const subjects = await BranchSubjectsService.list(BRANCH);
    assert.deepEqual(
      subjects.map((subject) => subject.name),
      ["Kjemi 2", "Realfag"],
    );
    const realfag = subjects.find((subject) => subject.name === "Realfag");
    assert.lengthOf(realfag?.books ?? [], 2);
    assert.equal(realfag?.books.find((b) => b.item.id === ITEM_KJEMI)?.rent, true);
    assert.equal(realfag?.books.find((b) => b.item.id === ITEM_FYSIKK)?.buy, true);
  });

  test("import skips categories that already exist as subjects and is re-runnable", async ({
    assert,
  }) => {
    sandbox
      .stub(StorageService.BranchItems, "aggregate")
      .resolves([{ itemId: ITEM_KJEMI, categories: ["Kjemi 2"], ...ALL_OFF }] as never);
    await BranchSubjectsService.create(BRANCH, {
      name: "kjemi2",
      externalName: "noe annet",
      books: [],
    });

    const result = await BranchSubjectsService.importFromBranchItems(BRANCH);

    assert.deepEqual(result, { createdSubjects: 0, skippedExisting: 1 });
    assert.lengthOf(await BranchSubject.all(), 1);
  });

  test("fetchSubjectsForUpload groups subjects by branch with resolved titles", async ({
    assert,
  }) => {
    stubItemTitles({ [ITEM_KJEMI]: "Kjemien stemmer" });
    await BranchSubjectsService.create(BRANCH, {
      name: "Kjemi 2",
      externalName: "Kjemi 2 programfag",
      books: [{ itemId: ITEM_KJEMI, ...ALL_OFF, rent: true }],
    });
    await BranchSubjectsService.create(BRANCH, { name: "Gym", externalName: "Gym", books: [] });

    const subjectsByBranchId = await fetchSubjectsForUpload([BRANCH, OTHER_BRANCH]);

    assert.deepEqual(
      subjectsByBranchId
        .get(BRANCH)
        ?.map((subject) => subject.externalName)
        .sort(),
      ["Gym", "Kjemi 2 programfag"],
    );
    assert.deepEqual(
      subjectsByBranchId
        .get(BRANCH)
        ?.find((subject) => subject.externalName === "Kjemi 2 programfag")?.books,
      [{ itemId: ITEM_KJEMI, title: "Kjemien stemmer" }],
    );
    assert.isUndefined(subjectsByBranchId.get(OTHER_BRANCH));
  });
});
