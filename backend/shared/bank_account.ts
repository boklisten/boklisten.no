/**
 * Norwegian bank account numbers: eleven digits, the last a MOD11 check digit, written with dots
 * as 1234.56.78903 (bank, account group, account and check digit).
 */

const ACCOUNT_LENGTH = 11;
const CHECK_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** The digits of the input, in order, with everything else dropped. */
function digitsOf(input: string): string {
  return input.replaceAll(/\D/g, "");
}

/** The MOD11 check digit for the first ten digits; null when the remainder gives no valid digit. */
function checkDigit(tenDigits: string): number | null {
  let weightedSum = 0;
  for (const [index, weight] of CHECK_WEIGHTS.entries()) {
    weightedSum += Number(tenDigits.charAt(index)) * weight;
  }
  const remainder = weightedSum % 11;
  if (remainder === 0) {
    return 0;
  }
  if (remainder === 1) {
    return null;
  }
  return 11 - remainder;
}

/**
 * The eleven digits of an account number written any way people write one, or null when it is
 * not a valid Norwegian account number.
 */
export function normalizeBankAccount(input: string): string | null {
  const digits = digitsOf(input);
  if (digits.length !== ACCOUNT_LENGTH) {
    return null;
  }
  return checkDigit(digits.slice(0, -1)) === Number(digits.at(-1)) ? digits : null;
}

/**
 * The digits with dots in the Norwegian places, as far as they go, so an input can format while
 * the number is being typed.
 */
export function formatBankAccount(input: string): string {
  const digits = digitsOf(input).slice(0, ACCOUNT_LENGTH);
  const groups = [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6)];
  return groups.filter((group) => group.length > 0).join(".");
}
