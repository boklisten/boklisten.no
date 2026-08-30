import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import { DateTime } from "luxon";
import { createSandbox } from "sinon";

import Signature from "#models/signature";
import { BranchRelationshipService } from "#services/branch_relationship_service";
import {
  BranchSignatureStatusService,
  MemberSignatureRow,
} from "#services/branch_signature_status_service";
import { StorageService } from "#services/storage_service";
import { unchecked } from "#tests/test-doubles";

function makeSignature(createdAt: DateTime, signedByGuardian: boolean): Signature {
  const signature = new Signature();
  signature.createdAt = createdAt;
  signature.signedByGuardian = signedByGuardian;
  return signature;
}

// Mirrors the calendar arithmetic in Signature.isExpired, so boundary tests are exact.
function monthsAgo(months: number): DateTime {
  const now = new Date();
  return DateTime.fromJSDate(new Date(now.getFullYear(), now.getMonth() - months, now.getDate()));
}

function yearsAgo(years: number): Date {
  const now = new Date();
  return new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
}

function adultWithSignature(overrides: Partial<MemberSignatureRow> = {}): MemberSignatureRow {
  return {
    dob: yearsAgo(30),
    signature: makeSignature(monthsAgo(1), false),
    ...overrides,
  };
}

test.group("BranchSignatureStatusService.summarize", () => {
  test("counts an adult with a fresh non-guardian signature as valid", ({ assert }) => {
    const result = BranchSignatureStatusService.summarize([adultWithSignature()]);
    assert.deepEqual(result, {
      totalMembers: 1,
      validSignature: 1,
      needsSignature: 0,
    });
  });

  test("counts an underage member with a guardian signature as valid", ({ assert }) => {
    const row: MemberSignatureRow = {
      dob: yearsAgo(10),
      signature: makeSignature(monthsAgo(1), true),
    };
    const result = BranchSignatureStatusService.summarize([row]);
    assert.equal(result.validSignature, 1);
  });

  test("counts a member without a signature as needing to sign", ({ assert }) => {
    const row: MemberSignatureRow = { dob: yearsAgo(30) };
    const result = BranchSignatureStatusService.summarize([row]);
    assert.deepEqual(result, {
      totalMembers: 1,
      validSignature: 0,
      needsSignature: 1,
    });
  });

  test("treats an expired signature as no signature", ({ assert }) => {
    const row = adultWithSignature({
      // Past the 48 month validity window
      signature: makeSignature(monthsAgo(49), false),
    });
    const result = BranchSignatureStatusService.summarize([row]);
    assert.equal(result.needsSignature, 1);
    assert.equal(result.validSignature, 0);
  });

  test("keeps a signature signed exactly 48 months ago valid", ({ assert }) => {
    const row = adultWithSignature({
      signature: makeSignature(monthsAgo(48), false),
    });
    const result = BranchSignatureStatusService.summarize([row]);
    assert.equal(result.validSignature, 1);
  });

  test("treats an adult's guardian-signed signature as invalid", ({ assert }) => {
    const row = adultWithSignature({
      signature: makeSignature(monthsAgo(1), true),
    });
    const result = BranchSignatureStatusService.summarize([row]);
    assert.equal(result.needsSignature, 1);
    assert.equal(result.validSignature, 0);
  });

  test("treats a member without dob as an adult", ({ assert }) => {
    const row: MemberSignatureRow = {
      signature: makeSignature(monthsAgo(1), false),
    };
    const result = BranchSignatureStatusService.summarize([row]);
    assert.equal(result.validSignature, 1);
  });

  test("sums members across both buckets", ({ assert }) => {
    const rows: MemberSignatureRow[] = [
      adultWithSignature(),
      { dob: yearsAgo(10) },
      { dob: yearsAgo(30) },
      { dob: yearsAgo(30) },
    ];
    const result = BranchSignatureStatusService.summarize(rows);
    assert.deepEqual(result, {
      totalMembers: 4,
      validSignature: 1,
      needsSignature: 3,
    });
  });
});

test.group("BranchSignatureStatusService.getStatus", (group) => {
  const sandbox = createSandbox();
  group.each.setup(() => testUtils.db().truncate());
  group.each.teardown(() => sandbox.restore());

  test("joins members of the branch and its descendants with their newest signature", async ({
    assert,
  }) => {
    const branchId = "5f7f7f7f7f7f7f7f7f7f7f7f";
    const childId = "6a7f7f7f7f7f7f7f7f7f7f7f";
    const signedMemberId = "aaaaaaaaaaaaaaaaaaaaaaaa";
    const unsignedMemberId = "bbbbbbbbbbbbbbbbbbbbbbbb";
    sandbox
      .stub(BranchRelationshipService, "getNestedChildBranchIds")
      .withArgs(branchId)
      .resolves([childId]);
    const aggregateStub = sandbox.stub(StorageService.UserDetails, "aggregate").resolves([
      { id: signedMemberId, dob: yearsAgo(30) },
      { id: unsignedMemberId, dob: yearsAgo(30) },
    ]);
    // An old guardian-signed signature that the newer valid one must shadow.
    await Signature.create({
      customerDetailsId: signedMemberId,
      signingName: "Guardian Guardiansen",
      signedByGuardian: true,
      image: Buffer.from("webp"),
      createdAt: DateTime.now().minus({ years: 1 }),
    });
    await Signature.create({
      customerDetailsId: signedMemberId,
      signingName: "Medlem Medlemsen",
      signedByGuardian: false,
      image: Buffer.from("webp"),
    });

    const result = await BranchSignatureStatusService.getStatus(branchId);

    assert.deepEqual(result, {
      totalMembers: 2,
      validSignature: 1,
      needsSignature: 1,
    });
    const pipeline: {
      $match?: { branchMembership?: { $in?: { toString(): string }[] } };
    }[] = unchecked(aggregateStub.firstCall.args[0]);
    const matchedIds = pipeline[0]?.$match?.branchMembership?.$in?.map((id) => id.toString());
    assert.deepEqual(matchedIds, [branchId, childId]);
  });
});
