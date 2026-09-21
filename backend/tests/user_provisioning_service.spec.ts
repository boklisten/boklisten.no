import { test } from "@japa/runner";
import * as Sentry from "@sentry/node";
import { DateTime } from "luxon";

import {
  applyBranchResolutions,
  buildBranchMappings,
  computeTasks,
  findDuplicateRows,
  mergeCandidateIntoUser,
  provisioningErrorMessage,
} from "#services/user_provisioning_service";
import { userDouble } from "#tests/user_fixtures";

const BRANCHES = [
  { id: "sta", name: "Ullern Oslo VG1 STA" },
  { id: "stb", name: "Ullern Oslo VG1 STB" },
  { id: "mka", name: "Ullern Oslo VG1 MKA" },
];

test.group("UserProvisioningService.buildBranchMappings()", () => {
  test("matches a localName contained in the normalized branch name", ({ assert }) => {
    const [mapping] = buildBranchMappings(["1STA"], BRANCHES);
    assert.deepEqual(mapping, {
      localName: "1STA",
      status: "matched",
      branch: { id: "sta", name: "Ullern Oslo VG1 STA" },
      candidates: [{ id: "sta", name: "Ullern Oslo VG1 STA" }],
    });
  });

  test("ignores casing and spacing in both input and branch name", ({ assert }) => {
    const [mapping] = buildBranchMappings([" 1 sta "], BRANCHES);
    assert.equal(mapping?.status, "matched");
    assert.equal(mapping?.branch?.id, "sta");
  });

  test("reports a localName matching no branches as unmatched", ({ assert }) => {
    const [mapping] = buildBranchMappings(["2KDA"], BRANCHES);
    assert.deepEqual(mapping, {
      localName: "2KDA",
      status: "unmatched",
      branch: null,
      candidates: [],
    });
  });

  test("reports a localName matching multiple branches as ambiguous", ({ assert }) => {
    const [mapping] = buildBranchMappings(["VG1"], BRANCHES);
    assert.equal(mapping?.status, "ambiguous");
    assert.isNull(mapping?.branch);
  });

  test("lists all ambiguous candidates with the closest branch name first", ({ assert }) => {
    const [mapping] = buildBranchMappings(
      ["3APO"],
      [
        { id: "apovok", name: "Ullern Oslo VG3 APOVOK" },
        { id: "apo", name: "Ullern Oslo VG3 APO" },
      ],
    );
    assert.equal(mapping?.status, "ambiguous");
    assert.deepEqual(
      mapping?.candidates.map((candidate) => candidate.id),
      ["apo", "apovok"],
    );
  });

  test("deduplicates localNames and sorts mappings alphabetically", ({ assert }) => {
    const mappings = buildBranchMappings(["1STB", "1STA", "1STB"], BRANCHES);
    assert.deepEqual(
      mappings.map((mapping) => mapping.localName),
      ["1STA", "1STB"],
    );
  });

  test("skips missing localNames instead of mapping them", ({ assert }) => {
    const mappings = buildBranchMappings(["1STA", undefined, ""], BRANCHES);
    assert.deepEqual(
      mappings.map((mapping) => mapping.localName),
      ["1STA"],
    );
  });
});

test.group("UserProvisioningService.applyBranchResolutions()", () => {
  const AMBIGUOUS_BRANCHES = [
    { id: "apo", name: "Ullern Oslo VG3 APO" },
    { id: "apovok", name: "Ullern Oslo VG3 APOVOK" },
  ];

  test("resolves an ambiguous mapping to the selected candidate", ({ assert }) => {
    const mappings = buildBranchMappings(["3APO"], AMBIGUOUS_BRANCHES);
    const [resolved] = applyBranchResolutions(mappings, [
      { localName: "3APO", branchId: "apovok" },
    ]);
    assert.equal(resolved?.status, "matched");
    assert.deepEqual(resolved?.branch, { id: "apovok", name: "Ullern Oslo VG3 APOVOK" });
  });

  test("keeps an ambiguous mapping when the selected branch is not a candidate", ({ assert }) => {
    const mappings = buildBranchMappings(["3APO"], AMBIGUOUS_BRANCHES);
    const [resolved] = applyBranchResolutions(mappings, [
      { localName: "3APO", branchId: "unrelated" },
    ]);
    assert.equal(resolved?.status, "ambiguous");
    assert.isNull(resolved?.branch);
  });

  test("leaves matched and unmatched mappings untouched", ({ assert }) => {
    const mappings = buildBranchMappings(["1STA", "2KDA"], BRANCHES);
    const resolved = applyBranchResolutions(mappings, [
      { localName: "1STA", branchId: "stb" },
      { localName: "2KDA", branchId: "sta" },
    ]);
    assert.deepEqual(resolved, mappings);
  });
});

const UNDERAGE_DOB = DateTime.now().startOf("day").minus({ years: 16 });

const EXISTING_USER = userDouble({
  id: "existing-id",
  name: "Ola Nordmann",
  email: "ola@example.com",
  phone: "12345678",
  address: "Gamleveien 1",
  postCode: "0501",
  postCity: "Oslo",
  dob: UNDERAGE_DOB,
  guardianName: "Kari Nordmann",
  guardianEmail: "kari@example.com",
  guardianPhone: "87654321",
});

test.group("UserProvisioningService.mergeCandidateIntoUser()", () => {
  test("overwrites fields present in the candidate", ({ assert }) => {
    const update = mergeCandidateIntoUser(
      {
        name: "Ola Normann",
        phone: "87654321",
        email: "ny@example.com",
        localName: "1STA",
        address: "Nyveien 2",
      },
      EXISTING_USER,
      "sta",
    );
    assert.equal(update.name, "Ola Normann");
    assert.equal(update.phone, "87654321");
    assert.equal(update.email, "ny@example.com");
    assert.equal(update.address, "Nyveien 2");
    assert.equal(update.branchMembershipId, "sta");
  });

  test("keeps existing values for fields the candidate did not provide", ({ assert }) => {
    const update = mergeCandidateIntoUser(
      {
        name: "Ola Nordmann",
        phone: "12345678",
        email: "ola@example.com",
        localName: "1STA",
      },
      EXISTING_USER,
      "sta",
    );
    assert.equal(update.address, "Gamleveien 1");
    assert.equal(update.postCode, "0501");
    assert.equal(update.postCity, "Oslo");
    assert.equal(update.dob?.toISODate(), UNDERAGE_DOB.toISODate());
  });

  test("reads a provided date of birth as the calendar day it names", ({ assert }) => {
    const update = mergeCandidateIntoUser(
      {
        name: "Ola Nordmann",
        phone: "12345678",
        email: "ola@example.com",
        dob: new Date("2009-05-17T00:00:00"),
      },
      EXISTING_USER,
      undefined,
    );
    assert.equal(update.dob?.toISODate(), "2009-05-17");
  });

  test("leaves branchMembershipId out of the update when no branch is given", ({ assert }) => {
    const update = mergeCandidateIntoUser(
      {
        name: "Ola Nordmann",
        phone: "12345678",
        email: "ola@example.com",
      },
      EXISTING_USER,
      undefined,
    );
    assert.notProperty(update, "branchMembershipId");
  });
});

test.group("UserProvisioningService.computeTasks()", () => {
  test("clears both tasks when details are complete and signature is valid", ({ assert }) => {
    assert.deepEqual(computeTasks(EXISTING_USER, true), {
      taskConfirmDetails: false,
      taskSignAgreement: false,
    });
  });

  test("requires confirmDetails when a required field is missing", ({ assert }) => {
    const incomplete = userDouble({ ...EXISTING_USER.$attributes, dob: null });
    assert.deepEqual(computeTasks(incomplete, true), {
      taskConfirmDetails: true,
      taskSignAgreement: false,
    });
  });

  test("requires signAgreement when the user has no valid signature", ({ assert }) => {
    assert.deepEqual(computeTasks(EXISTING_USER, false), {
      taskConfirmDetails: false,
      taskSignAgreement: true,
    });
  });
});

const candidate = (overrides: { name?: string; phone?: string; email?: string } = {}) => ({
  name: "Kari Nordmann",
  phone: "90000001",
  email: "kari@example.com",
  ...overrides,
});

test.group("UserProvisioningService.findDuplicateRows()", () => {
  test("marks no row as a duplicate when every row names a different person", ({ assert }) => {
    const rows = [
      candidate({ phone: "90000001", email: "a@example.com" }),
      candidate({ phone: "90000002", email: "b@example.com" }),
    ];
    assert.deepEqual(findDuplicateRows(rows, [null, null]), [null, null]);
  });

  test("points a repeated phone at the first row that used it", ({ assert }) => {
    const rows = [
      candidate({ phone: "90000001", email: "a@example.com" }),
      candidate({ phone: "90000002", email: "b@example.com" }),
      candidate({ phone: "90000001", email: "c@example.com" }),
    ];
    assert.deepEqual(findDuplicateRows(rows, [null, null, null]), [null, null, 0]);
  });

  test("points a repeated email at the first row that used it, ignoring casing", ({ assert }) => {
    const rows = [
      candidate({ phone: "90000001", email: "a@example.com" }),
      candidate({ phone: "90000002", email: "A@Example.com" }),
    ];
    assert.deepEqual(findDuplicateRows(rows, [null, null]), [null, 0]);
  });

  test("treats two rows resolving to the same existing customer as duplicates", ({ assert }) => {
    const rows = [
      candidate({ phone: "90000001", email: "a@example.com" }),
      candidate({ phone: "90000002", email: "b@example.com" }),
    ];
    const existing = userDouble({ id: "c0" });
    assert.deepEqual(findDuplicateRows(rows, [existing, existing]), [null, 0]);
  });

  test("keeps rows resolving to different existing customers", ({ assert }) => {
    const rows = [
      candidate({ phone: "90000001", email: "a@example.com" }),
      candidate({ phone: "90000002", email: "b@example.com" }),
    ];
    assert.deepEqual(
      findDuplicateRows(rows, [userDouble({ id: "c0" }), userDouble({ id: "c1" })]),
      [null, null],
    );
  });

  test("does not claim a duplicate's own phone for later rows", ({ assert }) => {
    const rows = [
      candidate({ phone: "90000001", email: "a@example.com" }),
      // Duplicate of row 0 by email, so its phone is never saved ...
      candidate({ phone: "90000002", email: "a@example.com" }),
      // ... and row 2 may use that phone.
      candidate({ phone: "90000002", email: "c@example.com" }),
    ];
    assert.deepEqual(findDuplicateRows(rows, [null, null, null]), [null, 0, null]);
  });

  test("points every later copy at the first row rather than at each other", ({ assert }) => {
    const rows = [
      candidate({ phone: "90000001", email: "a@example.com" }),
      candidate({ phone: "90000001", email: "a@example.com" }),
      candidate({ phone: "90000001", email: "a@example.com" }),
    ];
    assert.deepEqual(findDuplicateRows(rows, [null, null, null]), [null, 0, 0]);
  });
});

/** Sentry is never initialised under API_ENV=test, so stand up a client that records and drops. */
function recordEventsSentToSentry(): string[] {
  const captured: string[] = [];
  Sentry.init({
    dsn: "https://public@o0.ingest.sentry.io/0",
    enabled: true,
    defaultIntegrations: false,
    beforeSend(event) {
      captured.push(event.exception?.values?.[0]?.value ?? "");
      return null;
    },
  });
  return captured;
}

/** A knex/pg unique-violation error, as the driver hands it to the service. */
const uniqueViolation = (constraint: string) =>
  Object.assign(
    new Error(`insert into "users" (...) values ($1) - duplicate key value violates ${constraint}`),
    { code: "23505", constraint },
  );

test.group("UserProvisioningService.provisioningErrorMessage()", (group) => {
  group.each.teardown(async () => {
    await Sentry.close();
  });

  test("names the phone when the row collides on the phone index", ({ assert }) => {
    const message = provisioningErrorMessage(
      uniqueViolation("users_phone_unique"),
      candidate({ phone: "90000001" }),
    );
    assert.equal(message, "Mobilnummeret 90000001 tilhører allerede en annen kunde");
  });

  test("names the email when the row collides on the email index", ({ assert }) => {
    const message = provisioningErrorMessage(
      uniqueViolation("users_email_unique"),
      candidate({ email: "kari@example.com" }),
    );
    assert.equal(message, "E-postadressen kari@example.com tilhører allerede en annen kunde");
  });

  test("never leaks the SQL of an unexpected database error", async ({ assert }) => {
    const captured = recordEventsSentToSentry();
    const error = new Error('insert into "users" ("blid") values ($1) - column "blid" is null');

    const message = provisioningErrorMessage(error, candidate());

    assert.notInclude(message, "insert into");
    assert.equal(
      message,
      "Ukjent feil. Ta kontakt på teknisk@boklisten.no dersom det gjentar seg.",
    );
    await Sentry.flush(2000);
    assert.deepEqual(captured, [error.message]);
  });
});
