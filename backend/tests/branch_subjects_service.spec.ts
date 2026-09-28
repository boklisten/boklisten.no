import { test } from "@japa/runner";
import testUtils from "@adonisjs/core/services/test_utils";

import BranchSubject from "#models/branch_subject";
import BranchSubjectBook from "#models/branch_subject_book";
import { BranchSubjectsService, fetchSubjectsForUpload } from "#services/branch_subjects_service";
import { createBranch } from "#tests/branch_fixtures";
import { createItem } from "#tests/item_fixtures";

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
  group.each.setup(() => testUtils.db().truncate());
  group.each.setup(async () => {
    await createBranch({ id: BRANCH });
    await createBranch({ id: OTHER_BRANCH });
    await createItem({ id: ITEM_KJEMI, title: "Kjemien stemmer" });
    await createItem({ id: ITEM_FYSIKK, title: "Fysikkboka" });
  });

  test("creates a subject with books and lists it with item titles", async ({ assert }) => {
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
      /lastes allerede opp som/,
    );
  });

  test("stores no external name when it is blank or repeats the name", async ({ assert }) => {
    await BranchSubjectsService.create(BRANCH, { name: "Gym", externalName: null, books: [] });
    await BranchSubjectsService.create(BRANCH, { name: "Norsk", externalName: "  ", books: [] });
    await BranchSubjectsService.create(BRANCH, { name: "Tysk", externalName: "Tysk", books: [] });

    const subjects = await BranchSubjectsService.list(BRANCH);
    assert.deepEqual(
      subjects.map((subject) => subject.externalName),
      [null, null, null],
    );
  });

  test("rejects an external name that another subject is uploaded as by its name", async ({
    assert,
  }) => {
    await BranchSubjectsService.create(BRANCH, { name: "Kjemi 2", externalName: null, books: [] });
    await assert.rejects(
      () =>
        BranchSubjectsService.create(BRANCH, {
          name: "Kjemi",
          externalName: "kjemi 2",
          books: [],
        }),
      /lastes allerede opp som/,
    );
  });

  test("rejects a name without external name that another subject is uploaded as", async ({
    assert,
  }) => {
    await BranchSubjectsService.create(BRANCH, { name: "Kjemi", externalName: "K2", books: [] });
    await assert.rejects(
      () => BranchSubjectsService.create(BRANCH, { name: "K2", externalName: null, books: [] }),
      /lastes allerede opp som/,
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

  test("listingAt unions the options of every subject listing the book at the branch", async ({
    assert,
  }) => {
    await BranchSubjectsService.create(BRANCH, {
      name: "Kjemi 2",
      externalName: null,
      books: [{ itemId: ITEM_KJEMI, ...ALL_OFF, rent: true, rentAtBranch: true }],
    });
    await BranchSubjectsService.create(BRANCH, {
      name: "Realfag",
      externalName: null,
      books: [{ itemId: ITEM_KJEMI, ...ALL_OFF, buyAtBranch: true }],
    });
    // Another branch's subjects do not count.
    await BranchSubjectsService.create(OTHER_BRANCH, {
      name: "Kjemi 2",
      externalName: null,
      books: [{ itemId: ITEM_KJEMI, ...ALL_OFF, partlyPaymentAtBranch: true }],
    });

    assert.deepEqual(await BranchSubjectBook.listingAt(BRANCH, ITEM_KJEMI), {
      ...ALL_OFF,
      rent: true,
      rentAtBranch: true,
      buyAtBranch: true,
    });
  });

  test("listingAt is null for a book the branch does not list", async ({ assert }) => {
    await BranchSubjectsService.create(OTHER_BRANCH, {
      name: "Fysikk 1",
      externalName: null,
      books: [{ itemId: ITEM_FYSIKK, ...ALL_OFF, rent: true }],
    });

    assert.isNull(await BranchSubjectBook.listingAt(BRANCH, ITEM_FYSIKK));
  });

  test("fetchSubjectsForUpload groups subjects by upload name with resolved titles", async ({
    assert,
  }) => {
    await BranchSubjectsService.create(BRANCH, {
      name: "Kjemi 2",
      externalName: "Kjemi 2 programfag",
      books: [{ itemId: ITEM_KJEMI, ...ALL_OFF, rent: true }],
    });
    await BranchSubjectsService.create(BRANCH, { name: "Gym", externalName: null, books: [] });

    const subjectsByBranchId = await fetchSubjectsForUpload([BRANCH, OTHER_BRANCH]);

    assert.deepEqual(
      subjectsByBranchId
        .get(BRANCH)
        ?.map((subject) => subject.uploadName)
        .toSorted(),
      ["Gym", "Kjemi 2 programfag"],
    );
    assert.deepEqual(
      subjectsByBranchId.get(BRANCH)?.find((subject) => subject.uploadName === "Kjemi 2 programfag")
        ?.books,
      [{ itemId: ITEM_KJEMI, title: "Kjemien stemmer" }],
    );
    assert.isUndefined(subjectsByBranchId.get(OTHER_BRANCH));
  });
});
