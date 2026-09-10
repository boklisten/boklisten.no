import { test } from "@japa/runner";

import { formatBankAccount, normalizeBankAccount } from "#shared/bank_account";

test.group("normalizeBankAccount", () => {
  test("returns the eleven digits of a valid account number", ({ assert }) => {
    assert.equal(normalizeBankAccount("12345678903"), "12345678903");
  });

  test("ignores dots and spaces the way people write account numbers", ({ assert }) => {
    assert.equal(normalizeBankAccount("1234.56.78903"), "12345678903");
    assert.equal(normalizeBankAccount(" 1234 56 78903 "), "12345678903");
  });

  test("rejects a wrong check digit", ({ assert }) => {
    assert.isNull(normalizeBankAccount("12345678904"));
  });

  test("accepts a check digit of zero", ({ assert }) => {
    // Weighted sum 33 leaves remainder 0, so the check digit is 0
    assert.equal(normalizeBankAccount("15030000010"), "15030000010");
  });

  test("rejects a number whose check digit would be ten", ({ assert }) => {
    assert.isNull(normalizeBankAccount("12345678920"));
  });

  test("rejects anything but eleven digits", ({ assert }) => {
    assert.isNull(normalizeBankAccount("1234567890"));
    assert.isNull(normalizeBankAccount("123456789031"));
    assert.isNull(normalizeBankAccount("1234567890a"));
    assert.isNull(normalizeBankAccount(""));
  });
});

test.group("formatBankAccount", () => {
  test("writes the number with dots the Norwegian way", ({ assert }) => {
    assert.equal(formatBankAccount("12345678903"), "1234.56.78903");
  });

  test("formats as far as the digits go while the number is being typed", ({ assert }) => {
    assert.equal(formatBankAccount("12"), "12");
    assert.equal(formatBankAccount("1234"), "1234");
    assert.equal(formatBankAccount("12345"), "1234.5");
    assert.equal(formatBankAccount("123456"), "1234.56");
    assert.equal(formatBankAccount("1234567"), "1234.56.7");
    assert.equal(formatBankAccount("1234.56.789"), "1234.56.789");
  });

  test("drops anything that is not a digit and stops at eleven", ({ assert }) => {
    assert.equal(formatBankAccount("1234 56 78903 4x"), "1234.56.78903");
  });
});
