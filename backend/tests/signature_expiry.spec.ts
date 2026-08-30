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
