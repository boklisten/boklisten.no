/**
 * A search param read as a string. TanStack JSON-parses param values, so a numeric-looking
 * value arrives as a number — everything else non-string (missing, arrays, objects) reads as "".
 */
export function stringParam(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}
