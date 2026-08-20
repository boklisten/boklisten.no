import { test } from "@japa/runner";

import {
  applyBranchResolutions,
  buildBranchMappings,
  computeTasks,
  mergeCandidateIntoUserDetail,
  normalizePhone,
} from "#services/user_provisioning_service";
import { UserDetail } from "#shared/user-detail";

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

test.group("UserProvisioningService.normalizePhone()", () => {
  test("keeps the last eight digits, ignoring country code and spacing", ({ assert }) => {
    assert.equal(normalizePhone("+47 123 45 678"), "12345678");
    assert.equal(normalizePhone("12345678"), "12345678");
    assert.equal(normalizePhone("004712345678"), "12345678");
  });
});

const today = new Date();
const UNDERAGE_DOB = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());

const EXISTING_USER = {
  id: "existing-id",
  name: "Ola Nordmann",
  email: "ola@example.com",
  phone: "12345678",
  address: "Gamleveien 1",
  postCode: "0501",
  postCity: "Oslo",
  dob: UNDERAGE_DOB,
  guardian: {
    name: "Kari Nordmann",
    email: "kari@example.com",
    phone: "87654321",
  },
} as UserDetail;

test.group("UserProvisioningService.mergeCandidateIntoUserDetail()", () => {
  test("overwrites fields present in the candidate", ({ assert }) => {
    const update = mergeCandidateIntoUserDetail(
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
    assert.equal(update.branchMembership, "sta");
  });

  test("keeps existing values for fields the candidate did not provide", ({ assert }) => {
    const update = mergeCandidateIntoUserDetail(
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
    assert.deepEqual(update.dob, UNDERAGE_DOB);
  });

  test("leaves branchMembership out of the update when no branch is given", ({ assert }) => {
    const update = mergeCandidateIntoUserDetail(
      {
        name: "Ola Nordmann",
        phone: "12345678",
        email: "ola@example.com",
      },
      EXISTING_USER,
      undefined,
    );
    assert.notProperty(update, "branchMembership");
  });
});

test.group("UserProvisioningService.computeTasks()", () => {
  test("clears both tasks when details are complete and signature is valid", ({ assert }) => {
    assert.deepEqual(computeTasks(EXISTING_USER, true), {
      confirmDetails: false,
      signAgreement: false,
    });
  });

  test("requires confirmDetails when a required field is missing", ({ assert }) => {
    const incomplete = { ...EXISTING_USER, dob: undefined } as unknown as UserDetail;
    assert.deepEqual(computeTasks(incomplete, true), {
      confirmDetails: true,
      signAgreement: false,
    });
  });

  test("requires signAgreement when the user has no valid signature", ({ assert }) => {
    assert.deepEqual(computeTasks(EXISTING_USER, false), {
      confirmDetails: false,
      signAgreement: true,
    });
  });
});
