import { test } from "@japa/runner";

import {
  findInvalidDeadlines,
  findPastDeadlines,
  groupSubjectChoiceRows,
  matchStudent,
  planSubjectChoices,
  resolvePeriodType,
  resolveSubjectItems,
} from "#services/subject_choices_service";

const NOW = new Date("2026-08-17T12:00:00.000Z");

test.group("SubjectChoicesService.groupSubjectChoiceRows()", () => {
  test("groups rows for the same student and class together", ({ assert }) => {
    const groups = groupSubjectChoiceRows([
      { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
      { name: "kari  nordmann ", localName: "3sta", subject: "Fysikk 2", deadline: "2027-07-01" },
      { name: "Ola Hansen", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
    ]);
    assert.lengthOf(groups, 2);
    assert.deepEqual(
      groups[0]?.choices.map((choice) => choice.subject),
      ["Kjemi 2", "Fysikk 2"],
    );
  });

  test("drops exact duplicate subject rows within a group", ({ assert }) => {
    const groups = groupSubjectChoiceRows([
      { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
      { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
    ]);
    assert.lengthOf(groups, 1);
    assert.lengthOf(groups[0]?.choices ?? [], 1);
  });

  test("keeps the original name and class spelling of the first row", ({ assert }) => {
    const groups = groupSubjectChoiceRows([
      { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
      { name: "KARI NORDMANN", localName: "3sta", subject: "Fysikk 2", deadline: "2027-07-01" },
    ]);
    assert.equal(groups[0]?.name, "Kari Nordmann");
    assert.equal(groups[0]?.localName, "3STA");
  });
});

test.group("SubjectChoicesService.matchStudent()", () => {
  const members = [
    { id: "kari-a", name: "Kari Nordmann", branchMembership: "branch-3sta" },
    { id: "kari-b", name: "Kari Nordmann", branchMembership: "branch-3stb" },
    { id: "ola", name: "Ola Hansen", branchMembership: "branch-3stb" },
  ];

  test("matches a student by name within the resolved class branch", ({ assert }) => {
    const result = matchStudent({ name: "kari nordmann" }, members, "branch-3sta");
    assert.equal(result.status, "matched");
    assert.equal(result.status === "matched" ? result.member.id : null, "kari-a");
  });

  test("falls back to all members when the name is not found in the class branch", ({ assert }) => {
    const result = matchStudent({ name: "Ola Hansen" }, members, "branch-3sta");
    assert.equal(result.status, "matched");
    assert.equal(result.status === "matched" ? result.member.id : null, "ola");
  });

  test("reports ambiguous when the fallback matches several students", ({ assert }) => {
    const result = matchStudent({ name: "Kari Nordmann" }, members, null);
    assert.equal(result.status, "ambiguous");
    assert.equal(result.status === "ambiguous" ? result.matchCount : 0, 2);
  });

  test("reports unknown when no member has the name", ({ assert }) => {
    const result = matchStudent({ name: "Nils Nilsen" }, members, "branch-3sta");
    assert.equal(result.status, "unknown");
  });
});

test.group("SubjectChoicesService.resolveSubjectItems()", () => {
  const parentByBranchId = new Map([
    ["branch-a", "branch-st"],
    ["branch-st", "branch-vg1"],
    ["branch-vg1", "branch-school"],
  ]);
  const branchItemsByBranchId = new Map([
    ["branch-st", [{ itemId: "item-kjemi", title: "Kjemien stemmer", categories: ["Kjemi 2"] }]],
    [
      "branch-vg1",
      [
        { itemId: "item-kjemi-old", title: "Gammel kjemibok", categories: ["Kjemi 2"] },
        { itemId: "item-norsk", title: "Norskboka", categories: ["Norsk"] },
      ],
    ],
  ]);

  test("finds the subject in the lowest branch of the chain first", ({ assert }) => {
    const resolved = resolveSubjectItems({
      startBranchId: "branch-a",
      uploadBranchId: "branch-school",
      subject: "Kjemi 2",
      parentByBranchId,
      branchItemsByBranchId,
    });
    assert.deepEqual(
      resolved?.items.map((item) => item.itemId),
      ["item-kjemi"],
    );
  });

  test("walks up to an ancestor when lower branches lack the subject", ({ assert }) => {
    const resolved = resolveSubjectItems({
      startBranchId: "branch-a",
      uploadBranchId: "branch-school",
      subject: "Norsk",
      parentByBranchId,
      branchItemsByBranchId,
    });
    assert.deepEqual(
      resolved?.items.map((item) => item.itemId),
      ["item-norsk"],
    );
  });

  test("matches subjects case-insensitively and ignoring surrounding whitespace", ({ assert }) => {
    const resolved = resolveSubjectItems({
      startBranchId: "branch-a",
      uploadBranchId: "branch-school",
      subject: " kjemi 2 ",
      parentByBranchId,
      branchItemsByBranchId,
    });
    assert.deepEqual(
      resolved?.items.map((item) => item.itemId),
      ["item-kjemi"],
    );
  });

  test("returns null when the subject is not found anywhere in the chain", ({ assert }) => {
    const resolved = resolveSubjectItems({
      startBranchId: "branch-a",
      uploadBranchId: "branch-school",
      subject: "Religion",
      parentByBranchId,
      branchItemsByBranchId,
    });
    assert.isNull(resolved);
  });

  test("does not walk above the upload branch", ({ assert }) => {
    const input = {
      startBranchId: "branch-a",
      uploadBranchId: "branch-vg1",
      parentByBranchId: new Map([...parentByBranchId, ["branch-school", "branch-global"]]),
      branchItemsByBranchId: new Map([
        ...branchItemsByBranchId,
        [
          "branch-global",
          [{ itemId: "item-global", title: "Global bok", categories: ["Religion"] }],
        ],
      ]),
    };
    assert.isNull(resolveSubjectItems({ ...input, subject: "Religion" }));
    assert.deepEqual(
      resolveSubjectItems({ ...input, subject: "Norsk" })?.items.map((item) => item.itemId),
      ["item-norsk"],
    );
  });
});

test.group("SubjectChoicesService.resolvePeriodType()", () => {
  test("uses year when the deadline is more than six months away", ({ assert }) => {
    assert.equal(resolvePeriodType(new Date("2027-07-01"), NOW), "year");
  });

  test("uses semester when the deadline is within six months", ({ assert }) => {
    assert.equal(resolvePeriodType(new Date("2026-12-20"), NOW), "semester");
  });

  test("uses semester when the deadline is exactly six months away", ({ assert }) => {
    assert.equal(resolvePeriodType(new Date("2027-02-17T12:00:00.000Z"), NOW), "semester");
  });
});

test.group("SubjectChoicesService.planSubjectChoices()", () => {
  const baseInput = {
    uploadBranchId: "branch-school",
    members: [
      { id: "kari", name: "Kari Nordmann", branchMembership: "branch-3sta" },
      { id: "ola", name: "Ola Hansen", branchMembership: "branch-3sta" },
    ],
    klasseBranchIdByLocalName: new Map([["3STA", "branch-3sta"]]),
    parentByBranchId: new Map([["branch-3sta", "branch-school"]]),
    branchItemsByBranchId: new Map([
      [
        "branch-school",
        [
          { itemId: "item-kjemi", title: "Kjemien stemmer", categories: ["Kjemi 2"] },
          { itemId: "item-kjemi-2", title: "Kjemien stemmer arbeidsbok", categories: ["Kjemi 2"] },
          { itemId: "item-fysikk", title: "Fysikkboka", categories: ["Fysikk 2"] },
        ],
      ],
    ]),
    ownedItemKeys: new Set<string>(),
    now: NOW,
  };

  test("plans one order per student with all books for their subjects", ({ assert }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
        { name: "Kari Nordmann", localName: "3STA", subject: "Fysikk 2", deadline: "2027-07-01" },
        { name: "Ola Hansen", localName: "3STA", subject: "Fysikk 2", deadline: "2027-07-01" },
      ],
    });
    assert.lengthOf(plan.orders, 2);
    const kariOrder = plan.orders.find((order) => order.customerId === "kari");
    assert.deepEqual(
      kariOrder?.orderItems.map((orderItem) => orderItem.itemId),
      ["item-kjemi", "item-kjemi-2", "item-fysikk"],
    );
    assert.equal(plan.metrics.studentsWithOrders, 2);
    assert.equal(plan.metrics.totalBooks, 4);
  });

  test("skips books the student already possesses or has on order", ({ assert }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      ownedItemKeys: new Set(["kari:item-kjemi"]),
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
      ],
    });
    assert.deepEqual(
      plan.orders[0]?.orderItems.map((orderItem) => orderItem.itemId),
      ["item-kjemi-2"],
    );
    assert.equal(plan.metrics.skippedAlreadyOwned, 1);
  });

  test("leaves out students whose books are all covered already", ({ assert }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      ownedItemKeys: new Set(["kari:item-kjemi", "kari:item-kjemi-2"]),
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
      ],
    });
    assert.lengthOf(plan.orders, 0);
    assert.equal(plan.metrics.studentsWithOrders, 0);
    assert.equal(plan.metrics.studentsAlreadyCovered, 1);
  });

  test("orders a book only once when it appears in several subjects, keeping the earliest deadline", ({
    assert,
  }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      branchItemsByBranchId: new Map([
        [
          "branch-school",
          [{ itemId: "item-shared", title: "Delt bok", categories: ["Kjemi 2", "Fysikk 2"] }],
        ],
      ]),
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
        { name: "Kari Nordmann", localName: "3STA", subject: "Fysikk 2", deadline: "2026-12-20" },
      ],
    });
    assert.lengthOf(plan.orders[0]?.orderItems ?? [], 1);
    assert.equal(plan.orders[0]?.orderItems[0]?.deadline, "2026-12-20");
  });

  test("reports subjects that could not be resolved with how many students they affect", ({
    assert,
  }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Religion", deadline: "2027-07-01" },
        { name: "Ola Hansen", localName: "3STA", subject: "Religion", deadline: "2027-07-01" },
      ],
    });
    assert.deepEqual(plan.unknownSubjects, [{ subject: "Religion", studentCount: 2 }]);
    assert.lengthOf(plan.orders, 0);
  });

  test("reports students that could not be matched", ({ assert }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      rows: [
        { name: "Nils Nilsen", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
      ],
    });
    assert.deepEqual(plan.unknownUsers, [{ name: "Nils Nilsen", localName: "3STA" }]);
  });

  test("reports ambiguous students separately and skips them", ({ assert }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      members: [
        { id: "kari-a", name: "Kari Nordmann", branchMembership: "branch-3sta" },
        { id: "kari-b", name: "Kari Nordmann", branchMembership: "branch-3sta" },
      ],
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
      ],
    });
    assert.deepEqual(plan.ambiguousUsers, [
      { name: "Kari Nordmann", localName: "3STA", matchCount: 2 },
    ]);
    assert.lengthOf(plan.orders, 0);
  });

  test("sets periodType per order item based on its deadline", ({ assert }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
        { name: "Kari Nordmann", localName: "3STA", subject: "Fysikk 2", deadline: "2026-12-20" },
      ],
    });
    const orderItems = plan.orders[0]?.orderItems ?? [];
    assert.equal(orderItems.find((item) => item.itemId === "item-kjemi")?.periodType, "year");
    assert.equal(orderItems.find((item) => item.itemId === "item-fysikk")?.periodType, "semester");
  });

  test("assigns each order to the branch where its subjects were resolved", ({ assert }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      branchItemsByBranchId: new Map([
        [
          "branch-3sta",
          [{ itemId: "item-kjemi", title: "Kjemien stemmer", categories: ["Kjemi 2"] }],
        ],
      ]),
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
      ],
    });
    assert.equal(plan.orders[0]?.branchId, "branch-3sta");
  });

  test("merges rows for the same student listed under different classes", ({ assert }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
        { name: "Kari Nordmann", localName: "3STB", subject: "Kjemi 2", deadline: "2027-07-01" },
      ],
    });
    assert.lengthOf(plan.orders, 1);
    assert.deepEqual(
      plan.orders[0]?.orderItems.map((orderItem) => orderItem.itemId),
      ["item-kjemi", "item-kjemi-2"],
    );
    assert.equal(plan.metrics.studentsWithOrders, 1);
    assert.equal(plan.metrics.totalBooks, 2);
  });

  test("counts owned books only once for a student listed under different classes", ({
    assert,
  }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      ownedItemKeys: new Set(["kari:item-kjemi", "kari:item-kjemi-2"]),
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
        { name: "Kari Nordmann", localName: "3STB", subject: "Kjemi 2", deadline: "2027-07-01" },
      ],
    });
    assert.equal(plan.metrics.skippedAlreadyOwned, 2);
    assert.equal(plan.metrics.studentsAlreadyCovered, 1);
  });

  test("splits a student's books into separate orders per resolving branch", ({ assert }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      branchItemsByBranchId: new Map([
        [
          "branch-3sta",
          [{ itemId: "item-kjemi", title: "Kjemien stemmer", categories: ["Kjemi 2"] }],
        ],
        [
          "branch-school",
          [{ itemId: "item-fysikk", title: "Fysikkboka", categories: ["Fysikk 2"] }],
        ],
      ]),
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
        { name: "Kari Nordmann", localName: "3STA", subject: "Fysikk 2", deadline: "2027-07-01" },
      ],
    });
    assert.lengthOf(plan.orders, 2);
    assert.deepEqual(
      plan.orders.map((order) => order.customerId),
      ["kari", "kari"],
    );
    assert.sameMembers(
      plan.orders.map((order) => order.branchId),
      ["branch-3sta", "branch-school"],
    );
    assert.equal(plan.metrics.studentsWithOrders, 1);
    assert.equal(plan.metrics.totalBooks, 2);
  });
});

test.group("SubjectChoicesService.findInvalidDeadlines()", () => {
  test("reports dates that do not exist in the calendar", ({ assert }) => {
    const invalidDeadlines = findInvalidDeadlines([
      { deadline: "2027-02-30" },
      { deadline: "2027-13-01" },
      { deadline: "2027-07-01" },
      { deadline: "2027-02-30" },
    ]);
    assert.deepEqual(invalidDeadlines, ["2027-02-30", "2027-13-01"]);
  });

  test("returns nothing when every deadline is a real date", ({ assert }) => {
    const invalidDeadlines = findInvalidDeadlines([
      { deadline: "2027-07-01" },
      { deadline: "2028-02-29" },
    ]);
    assert.deepEqual(invalidDeadlines, []);
  });
});

test.group("SubjectChoicesService.findPastDeadlines()", () => {
  test("reports deadlines that are today or earlier", ({ assert }) => {
    const pastDeadlines = findPastDeadlines(
      [
        { deadline: "2026-08-16" },
        { deadline: "2026-08-17" },
        { deadline: "2027-07-01" },
        { deadline: "2026-08-16" },
      ],
      NOW,
    );
    assert.deepEqual(pastDeadlines, ["2026-08-16", "2026-08-17"]);
  });

  test("returns nothing when every deadline is in the future", ({ assert }) => {
    const pastDeadlines = findPastDeadlines([{ deadline: "2026-08-18" }], NOW);
    assert.deepEqual(pastDeadlines, []);
  });
});
