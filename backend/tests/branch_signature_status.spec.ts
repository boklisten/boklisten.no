import { test } from "@japa/runner";
import { createSandbox } from "sinon";

import { BranchRelationshipService } from "#services/branch_relationship_service";
import {
  BranchSignatureStatusService,
  MemberSignatureRow,
} from "#services/branch_signature_status_service";
import { StorageService } from "#services/storage_service";

const NOW = new Date(2026, 7, 18);

function adultWithSignature(overrides: Partial<MemberSignatureRow> = {}): MemberSignatureRow {
  return {
    dob: new Date(1990, 0, 1),
    signAgreement: false,
    signature: { creationTime: new Date(2026, 5, 1), signedByGuardian: false },
    ...overrides,
  };
}

test.group("BranchSignatureStatusService.summarize", () => {
  test("counts an adult with a fresh non-guardian signature as valid", ({ assert }) => {
    const result = BranchSignatureStatusService.summarize([adultWithSignature()], NOW);
    assert.deepEqual(result, {
      totalMembers: 1,
      validSignature: 1,
      needsSignature: 0,
      noSignatureNeeded: 0,
    });
  });

  test("counts an underage member with a guardian signature as valid", ({ assert }) => {
    const row: MemberSignatureRow = {
      dob: new Date(2010, 0, 1),
      signAgreement: false,
      signature: { creationTime: new Date(2026, 5, 1), signedByGuardian: true },
    };
    const result = BranchSignatureStatusService.summarize([row], NOW);
    assert.equal(result.validSignature, 1);
  });

  test("counts a member with the signAgreement task and no signature as needing to sign", ({
    assert,
  }) => {
    const row: MemberSignatureRow = { dob: new Date(1990, 0, 1), signAgreement: true };
    const result = BranchSignatureStatusService.summarize([row], NOW);
    assert.deepEqual(result, {
      totalMembers: 1,
      validSignature: 0,
      needsSignature: 1,
      noSignatureNeeded: 0,
    });
  });

  test("treats an expired signature as no signature", ({ assert }) => {
    const row = adultWithSignature({
      signAgreement: true,
      // 49 months before NOW — past the 48 month validity window
      signature: { creationTime: new Date(2022, 6, 18), signedByGuardian: false },
    });
    const result = BranchSignatureStatusService.summarize([row], NOW);
    assert.equal(result.needsSignature, 1);
    assert.equal(result.validSignature, 0);
  });

  test("keeps a signature signed exactly 48 months ago valid", ({ assert }) => {
    const row = adultWithSignature({
      signature: { creationTime: new Date(2022, 7, 18), signedByGuardian: false },
    });
    const result = BranchSignatureStatusService.summarize([row], NOW);
    assert.equal(result.validSignature, 1);
  });

  test("treats an adult's guardian-signed signature as invalid", ({ assert }) => {
    const row = adultWithSignature({
      signAgreement: true,
      signature: { creationTime: new Date(2026, 5, 1), signedByGuardian: true },
    });
    const result = BranchSignatureStatusService.summarize([row], NOW);
    assert.equal(result.needsSignature, 1);
    assert.equal(result.validSignature, 0);
  });

  test("counts a member without the task and without a signature as not needing to sign", ({
    assert,
  }) => {
    const row: MemberSignatureRow = { dob: new Date(1990, 0, 1) };
    const result = BranchSignatureStatusService.summarize([row], NOW);
    assert.deepEqual(result, {
      totalMembers: 1,
      validSignature: 0,
      needsSignature: 0,
      noSignatureNeeded: 1,
    });
  });

  test("counts a valid signature even when the task flag is stale", ({ assert }) => {
    const row = adultWithSignature({ signAgreement: true });
    const result = BranchSignatureStatusService.summarize([row], NOW);
    assert.equal(result.validSignature, 1);
    assert.equal(result.needsSignature, 0);
  });

  test("treats a member without dob as an adult", ({ assert }) => {
    const row: MemberSignatureRow = {
      signature: { creationTime: new Date(2026, 5, 1), signedByGuardian: false },
    };
    const result = BranchSignatureStatusService.summarize([row], NOW);
    assert.equal(result.validSignature, 1);
  });

  test("sums members across all buckets", ({ assert }) => {
    const rows: MemberSignatureRow[] = [
      adultWithSignature(),
      { dob: new Date(2010, 0, 1), signAgreement: true },
      { dob: new Date(1990, 0, 1) },
      { dob: new Date(1990, 0, 1) },
    ];
    const result = BranchSignatureStatusService.summarize(rows, NOW);
    assert.deepEqual(result, {
      totalMembers: 4,
      validSignature: 1,
      needsSignature: 1,
      noSignatureNeeded: 2,
    });
  });
});

test.group("BranchSignatureStatusService.getStatus", (group) => {
  const sandbox = createSandbox();
  group.each.teardown(() => sandbox.restore());

  test("aggregates members of the branch and its descendants", async ({ assert }) => {
    const branchId = "5f7f7f7f7f7f7f7f7f7f7f7f";
    const childId = "6a7f7f7f7f7f7f7f7f7f7f7f";
    sandbox
      .stub(BranchRelationshipService, "getNestedChildBranchIds")
      .withArgs(branchId)
      .resolves([childId]);
    const aggregateStub = sandbox
      .stub(StorageService.UserDetails, "aggregate")
      .resolves([
        { dob: new Date(1990, 0, 1), signAgreement: true },
        { dob: new Date(1990, 0, 1) },
      ]);

    const result = await BranchSignatureStatusService.getStatus(branchId);

    assert.equal(result.totalMembers, 2);
    assert.equal(result.needsSignature, 1);
    assert.equal(result.noSignatureNeeded, 1);
    const pipeline = aggregateStub.firstCall.args[0] as {
      $match?: { branchMembership?: { $in?: { toString(): string }[] } };
    }[];
    const matchedIds = pipeline[0]?.$match?.branchMembership?.$in?.map((id) => id.toString());
    assert.deepEqual(matchedIds, [branchId, childId]);
  });
});
