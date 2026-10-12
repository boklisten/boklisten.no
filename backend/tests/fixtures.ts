import { Exception } from "@adonisjs/core/exceptions";
import { HttpContextFactory } from "@adonisjs/core/factories/http";
import type { HttpContext } from "@adonisjs/core/http";

import { isObjectIdHex } from "#models/helpers/object_id";
import type User from "#models/user";
import { mock, unchecked } from "#tests/test-doubles";

/**
 * Deterministic 24-character hex ids for spec fixtures, readable in assertion output:
 * `fixtureId(1)` is `"000000000000000000000001"`, `fixtureId("a1")` is `"0000000000000000000000a1"`.
 * They are valid ObjectId hex, so they pass the same checks as real primary keys, and they
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

/** The HTTP status of the exception `work` rejects with, `undefined` when it resolves. */
export async function rejectionStatus(work: Promise<unknown>): Promise<number | undefined> {
  const failure: unknown = await work.then(
    () => null,
    (error: unknown) => error,
  );
  return failure instanceof Exception ? failure.status : undefined;
}

/**
 * A request from `user` with the validated `body` (or query) and the route `params`, for driving
 * a controller method directly: a real context, so `serialize` and the response helpers behave
 * as in production, with the parts the middleware would have filled in stubbed.
 */
export function contextFor(
  user: User,
  { body = {}, params = {} }: { body?: object; params?: Record<string, string> } = {},
): HttpContext {
  const ctx = new HttpContextFactory().create();
  ctx.params = params;
  ctx.request.validateUsing = unchecked(() => Promise.resolve(body));
  ctx.auth = mock<HttpContext["auth"]>({
    check: () => Promise.resolve(true),
    getUserOrFail: () => user,
  });
  return ctx;
}
