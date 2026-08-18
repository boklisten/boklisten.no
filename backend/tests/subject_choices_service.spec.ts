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
  const subjectsByBranchId = new Map([
    [
      "branch-st",
      [{ externalName: "Kjemi 2", books: [{ itemId: "item-kjemi", title: "Kjemien stemmer" }] }],
    ],
    [
      "branch-vg1",
      [
        {
          externalName: "Kjemi 2",
          books: [{ itemId: "item-kjemi-old", title: "Gammel kjemibok" }],
        },
        { externalName: "Norsk", books: [{ itemId: "item-norsk", title: "Norskboka" }] },
      ],
    ],
  ]);

  test("finds the subject in the lowest branch of the chain first", ({ assert }) => {
    const resolved = resolveSubjectItems({
      startBranchId: "branch-a",
      uploadBranchId: "branch-school",
      subject: "Kjemi 2",
      parentByBranchId,
      subjectsByBranchId,
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
      subjectsByBranchId,
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
      subjectsByBranchId,
    });
    assert.deepEqual(
      resolved?.items.map((item) => item.itemId),
      ["item-kjemi"],
    );
  });

  test("resolves a subject with no books to an empty item list, not null", ({ assert }) => {
    const resolved = resolveSubjectItems({
      startBranchId: "branch-a",
      uploadBranchId: "branch-school",
      subject: "Gym",
      parentByBranchId,
      subjectsByBranchId: new Map([
        ...subjectsByBranchId,
        ["branch-school", [{ externalName: "Gym", books: [] }]],
      ]),
    });
    assert.deepEqual(resolved, { branchId: "branch-school", items: [] });
  });

  test("returns null when the subject is not found anywhere in the chain", ({ assert }) => {
    const resolved = resolveSubjectItems({
      startBranchId: "branch-a",
      uploadBranchId: "branch-school",
      subject: "Religion",
      parentByBranchId,
      subjectsByBranchId,
    });
    assert.isNull(resolved);
  });

  test("does not walk above the upload branch", ({ assert }) => {
    const input = {
      startBranchId: "branch-a",
      uploadBranchId: "branch-vg1",
      parentByBranchId: new Map([...parentByBranchId, ["branch-school", "branch-global"]]),
      subjectsByBranchId: new Map([
        ...subjectsByBranchId,
        [
          "branch-global",
          [{ externalName: "Religion", books: [{ itemId: "item-global", title: "Global bok" }] }],
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
    subjectsByBranchId: new Map([
      [
        "branch-school",
        [
          {
            externalName: "Kjemi 2",
            books: [
              { itemId: "item-kjemi", title: "Kjemien stemmer" },
              { itemId: "item-kjemi-2", title: "Kjemien stemmer arbeidsbok" },
            ],
          },
          { externalName: "Fysikk 2", books: [{ itemId: "item-fysikk", title: "Fysikkboka" }] },
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
      subjectsByBranchId: new Map([
        [
          "branch-school",
          [
            { externalName: "Kjemi 2", books: [{ itemId: "item-shared", title: "Delt bok" }] },
            { externalName: "Fysikk 2", books: [{ itemId: "item-shared", title: "Delt bok" }] },
          ],
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

  /** The two GYMNOS editions customers order interchangeably. */
  const GYMNOS_2009 = "5b6441c4d2e733002fae89a6";
  const GYMNOS_2012 = "5b6441b2d2e733002fae87a6";

  test("skips a book when the student possesses or ordered an equivalent edition", ({ assert }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      subjectsByBranchId: new Map([
        [
          "branch-school",
          [
            {
              externalName: "Kroppsøving",
              books: [{ itemId: GYMNOS_2012, title: "Gymnos 2012" }],
            },
          ],
        ],
      ]),
      ownedItemKeys: new Set([`kari:${GYMNOS_2009}`]),
      rows: [
        {
          name: "Kari Nordmann",
          localName: "3STA",
          subject: "Kroppsøving",
          deadline: "2027-07-01",
        },
      ],
    });
    assert.lengthOf(plan.orders, 0);
    assert.equal(plan.metrics.skippedAlreadyOwned, 1);
    assert.equal(plan.metrics.studentsAlreadyCovered, 1);
  });

  test("orders one edition only when subjects resolve to equivalent editions", ({ assert }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      subjectsByBranchId: new Map([
        [
          "branch-school",
          [
            {
              externalName: "Kroppsøving",
              books: [{ itemId: GYMNOS_2009, title: "Gymnos 2009" }],
            },
            {
              externalName: "Toppidrett",
              books: [{ itemId: GYMNOS_2012, title: "Gymnos 2012" }],
            },
          ],
        ],
      ]),
      rows: [
        {
          name: "Kari Nordmann",
          localName: "3STA",
          subject: "Kroppsøving",
          deadline: "2027-07-01",
        },
        { name: "Kari Nordmann", localName: "3STA", subject: "Toppidrett", deadline: "2026-12-20" },
      ],
    });
    assert.deepEqual(
      plan.orders[0]?.orderItems.map((orderItem) => orderItem.itemId),
      [GYMNOS_2009],
      "the first edition encountered is the one ordered",
    );
    assert.equal(plan.orders[0]?.orderItems[0]?.deadline, "2026-12-20");
    assert.equal(plan.metrics.totalBooks, 1);
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

  test("counts choices that match a subject without books instead of warning about them", ({
    assert,
  }) => {
    const plan = planSubjectChoices({
      ...baseInput,
      subjectsByBranchId: new Map([
        [
          "branch-school",
          [
            { externalName: "Gym", books: [] },
            {
              externalName: "Kjemi 2",
              books: [{ itemId: "item-kjemi", title: "Kjemien stemmer" }],
            },
          ],
        ],
      ]),
      rows: [
        { name: "Kari Nordmann", localName: "3STA", subject: "Gym", deadline: "2027-07-01" },
        { name: "Kari Nordmann", localName: "3STA", subject: "Kjemi 2", deadline: "2027-07-01" },
        { name: "Ola Hansen", localName: "3STA", subject: "Gym", deadline: "2027-07-01" },
      ],
    });
    assert.equal(plan.metrics.choicesWithoutBooks, 2);
    assert.deepEqual(plan.unknownSubjects, []);
    assert.lengthOf(plan.orders, 1);
    assert.deepEqual(
      plan.orders[0]?.orderItems.map((orderItem) => orderItem.itemId),
      ["item-kjemi"],
    );
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
      subjectsByBranchId: new Map([
        [
          "branch-3sta",
          [
            {
              externalName: "Kjemi 2",
              books: [{ itemId: "item-kjemi", title: "Kjemien stemmer" }],
            },
          ],
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
      subjectsByBranchId: new Map([
        [
          "branch-3sta",
          [
            {
              externalName: "Kjemi 2",
              books: [{ itemId: "item-kjemi", title: "Kjemien stemmer" }],
            },
          ],
        ],
        [
          "branch-school",
          [{ externalName: "Fysikk 2", books: [{ itemId: "item-fysikk", title: "Fysikkboka" }] }],
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
