import { test } from "@japa/runner";
import { DateTime } from "luxon";

import Signature, { SIGNATURE_NUM_MONTHS_VALID } from "#models/signature";

function makeSignature(signedByGuardian: boolean): Signature {
  const signature = new Signature();
  signature.createdAt = DateTime.now();
  signature.signedByGuardian = signedByGuardian;
  return signature;
}

function dobForAge(years: number): Date {
  const now = new Date();
  return new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
}

test.group("Signature.expiresAtFor", () => {
  test("uses the ordinary validity window for a customer's own signature", ({ assert }) => {
    const signature = makeSignature(false);
    const expiresAt = signature.expiresAtFor({ dob: dobForAge(16) });
    assert.equal(
      expiresAt?.toISODate(),
      signature.createdAt?.plus({ months: SIGNATURE_NUM_MONTHS_VALID }).toISODate(),
    );
  });

  test("caps a guardian signature at the customer's 18th birthday", ({ assert }) => {
    const signature = makeSignature(true);
    const dob = dobForAge(16);
    const expiresAt = signature.expiresAtFor({ dob });
    const eighteenthBirthday = DateTime.fromJSDate(dob).plus({ years: 18 });
    assert.equal(expiresAt?.toISODate(), eighteenthBirthday.toISODate());
  });

  test("keeps the ordinary window for a guardian signature when it ends before the 18th birthday", ({
    assert,
  }) => {
    const signature = makeSignature(true);
    const expiresAt = signature.expiresAtFor({ dob: dobForAge(10) });
    assert.equal(
      expiresAt?.toISODate(),
      signature.createdAt?.plus({ months: SIGNATURE_NUM_MONTHS_VALID }).toISODate(),
    );
  });

  test("falls back to the ordinary window when the customer has no dob", ({ assert }) => {
    const signature = makeSignature(true);
    const expiresAt = signature.expiresAtFor({ dob: null });
    assert.equal(
      expiresAt?.toISODate(),
      signature.createdAt?.plus({ months: SIGNATURE_NUM_MONTHS_VALID }).toISODate(),
    );
  });
});

test.group("Signature.isOutgrownGuardianFor", () => {
  test("is true for a guardian signature once the customer is an adult", ({ assert }) => {
    assert.isTrue(makeSignature(true).isOutgrownGuardianFor({ dob: dobForAge(18) }));
  });

  test("is true when the customer has no dob, since they count as an adult", ({ assert }) => {
    assert.isTrue(makeSignature(true).isOutgrownGuardianFor({ dob: null }));
  });

  test("is false while the customer is still underage", ({ assert }) => {
    assert.isFalse(makeSignature(true).isOutgrownGuardianFor({ dob: dobForAge(16) }));
  });

  test("is false for the customer's own signature", ({ assert }) => {
    assert.isFalse(makeSignature(false).isOutgrownGuardianFor({ dob: dobForAge(18) }));
  });

  test("is false once the guardian signature has run out of its validity window", ({ assert }) => {
    const signature = makeSignature(true);
    signature.createdAt = DateTime.now().minus({ months: SIGNATURE_NUM_MONTHS_VALID + 1 });
    assert.isFalse(signature.isOutgrownGuardianFor({ dob: dobForAge(18) }));
  });
});
