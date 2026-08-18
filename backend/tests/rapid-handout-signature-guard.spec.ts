import { test } from "@japa/runner";
import { expect } from "chai";
import sinon, { createSandbox } from "sinon";

import { verifyCustomerSignature } from "#services/legacy/signature.helper";
import { StorageService } from "#services/storage_service";
import type { UserDetail } from "#shared/user-detail";

const adultDob = new Date(new Date().getFullYear() - 30, 0, 1);
const childDob = new Date(new Date().getFullYear() - 10, 0, 1);

function userDetailWith(overrides: Partial<UserDetail>): UserDetail {
  return {
    id: "customer1",
    name: "Test Kunde",
    dob: adultDob,
    signatures: [],
    ...overrides,
  } as UserDetail;
}

test.group("verifyCustomerSignature", (group) => {
  let sandbox: sinon.SinonSandbox;
  let userDetailStub: sinon.SinonStub;
  let signatureStub: sinon.SinonStub;

  group.each.setup(() => {
    sandbox = createSandbox();
    userDetailStub = sandbox.stub(StorageService.UserDetails, "getOrNull");
    signatureStub = sandbox.stub(StorageService.Signatures, "get");
  });
  group.each.teardown(() => {
    sandbox.restore();
  });

  test("should return feedback when the customer does not exist", async () => {
    userDetailStub.resolves(null);

    const feedback = await verifyCustomerSignature("missing-customer");

    expect(feedback).to.be.a("string").and.to.contain("signatur");
  });

  test("should return feedback when the customer has no signatures", async () => {
    userDetailStub.resolves(userDetailWith({ signatures: [] }));

    const feedback = await verifyCustomerSignature("customer1");

    expect(feedback).to.be.a("string").and.to.contain("signatur");
  });

  test("should return feedback when the newest signature is expired", async () => {
    userDetailStub.resolves(userDetailWith({ signatures: ["signature1"] }));
    signatureStub.resolves({
      signedByGuardian: false,
      creationTime: new Date(2000, 0, 1),
    });

    const feedback = await verifyCustomerSignature("customer1");

    expect(feedback).to.be.a("string").and.to.contain("signatur");
  });

  test("should return feedback when an underage customer signed without a guardian", async () => {
    userDetailStub.resolves(userDetailWith({ dob: childDob, signatures: ["signature1"] }));
    signatureStub.resolves({
      signedByGuardian: false,
      creationTime: new Date(),
    });

    const feedback = await verifyCustomerSignature("customer1");

    expect(feedback).to.be.a("string").and.to.contain("signatur");
  });

  test("should return null when the customer has a valid signature", async () => {
    userDetailStub.resolves(userDetailWith({ signatures: ["signature1"] }));
    signatureStub.resolves({
      signedByGuardian: false,
      creationTime: new Date(),
    });

    const feedback = await verifyCustomerSignature("customer1");

    expect(feedback).to.equal(null);
  });
});
