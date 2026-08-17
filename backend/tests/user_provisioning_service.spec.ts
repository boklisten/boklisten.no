import { test } from "@japa/runner";

import {
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
    });
  });

  test("ignores casing and spacing in both input and branch name", ({ assert }) => {
    const [mapping] = buildBranchMappings([" 1 sta "], BRANCHES);
    assert.equal(mapping?.status, "matched");
    assert.equal(mapping?.branch?.id, "sta");
  });

  test("reports a localName matching no branches as unmatched", ({ assert }) => {
    const [mapping] = buildBranchMappings(["2KDA"], BRANCHES);
    assert.deepEqual(mapping, { localName: "2KDA", status: "unmatched", branch: null });
  });

  test("reports a localName matching multiple branches as ambiguous", ({ assert }) => {
    const [mapping] = buildBranchMappings(["VG1"], BRANCHES);
    assert.equal(mapping?.status, "ambiguous");
    assert.isNull(mapping?.branch);
  });

  test("deduplicates localNames and sorts mappings alphabetically", ({ assert }) => {
    const mappings = buildBranchMappings(["1STB", "1STA", "1STB"], BRANCHES);
    assert.deepEqual(
      mappings.map((mapping) => mapping.localName),
      ["1STA", "1STB"],
    );
  });
});

test.group("UserProvisioningService.normalizePhone()", () => {
  test("keeps the last eight digits, ignoring country code and spacing", ({ assert }) => {
    assert.equal(normalizePhone("+47 123 45 678"), "12345678");
    assert.equal(normalizePhone("12345678"), "12345678");
    assert.equal(normalizePhone("004712345678"), "12345678");
  });
});

const EXISTING_USER = {
  id: "existing-id",
  name: "Ola Nordmann",
  email: "ola@example.com",
  phone: "12345678",
  address: "Gamleveien 1",
  postCode: "0501",
  postCity: "Oslo",
  dob: new Date("2010-04-01"),
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
    assert.deepEqual(update.dob, new Date("2010-04-01"));
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
