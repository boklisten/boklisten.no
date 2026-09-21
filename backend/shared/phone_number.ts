/**
 * The digits of a phone number as the site stores them: surrounding and inner whitespace and a
 * `+47`/`0047` country code are dropped, so "+47 912 34 567" and "91234567" compare equal.
 * Nothing else is touched; the caller decides whether what is left is a valid number.
 */
export function phoneDigits(value: string): string {
  return value.replaceAll(/\s/g, "").replace(/^(?<countryCode>\+47|0047)/, "");
}
