import { isObjectIdHex } from "#models/helpers/object_id";

/**
 * Deterministic 24-character hex ids for spec fixtures, readable in assertion output:
 * `fixtureId(1)` is `"000000000000000000000001"`, `fixtureId("a1")` is `"0000000000000000000000a1"`.
 * They are valid ObjectId hex, so they pass the same checks as ids transferred from Mongo, and they
 * cannot collide with ids `newObjectId()` generates (those start with the current timestamp).
 */
export function fixtureId(sequence: number | string): string {
  const hex = typeof sequence === "number" ? sequence.toString(16) : sequence.toLowerCase();
  const id = hex.padStart(24, "0");
  if (!isObjectIdHex(id)) {
    throw new TypeError(`cannot build a fixture id from ${JSON.stringify(sequence)}`);
  }
  return id;
}
