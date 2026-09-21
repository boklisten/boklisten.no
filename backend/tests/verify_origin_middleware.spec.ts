import { HttpContextFactory } from "@adonisjs/core/factories/http";
import type { HttpContext } from "@adonisjs/core/http";
import { test } from "@japa/runner";

import VerifyOriginMiddleware, { requestOrigin } from "#middleware/verify_origin_middleware";
import { mock } from "#tests/test-doubles";

/** The local frontend, which is what `clientOrigin` resolves to outside Railway. */
const OUR_ORIGIN = "http://localhost:3000";

function contextFor(
  method: string,
  headers: Record<string, string> = {},
  routePattern?: string,
): HttpContext {
  const ctx = new HttpContextFactory().create();
  ctx.request.request.method = method;
  Object.assign(ctx.request.request.headers, headers);
  if (routePattern !== undefined) {
    ctx.route = mock<NonNullable<HttpContext["route"]>>({ pattern: routePattern });
  }
  return ctx;
}

async function runMiddleware(ctx: HttpContext): Promise<boolean> {
  let nextCalled = false;
  await new VerifyOriginMiddleware().handle(ctx, () => {
    nextCalled = true;
    return Promise.resolve();
  });
  return nextCalled;
}

test.group("VerifyOriginMiddleware", () => {
  test("lets a state-changing request from our own frontend through", async ({ assert }) => {
    assert.isTrue(await runMiddleware(contextFor("POST", { origin: OUR_ORIGIN })));
  });

  test("lets any GET through, whatever the origin", async ({ assert }) => {
    assert.isTrue(await runMiddleware(contextFor("GET", { origin: "https://evil.example" })));
    assert.isTrue(await runMiddleware(contextFor("GET")));
  });

  test("rejects a state-changing request from another site", async ({ assert }) => {
    await assert.rejects(
      () => runMiddleware(contextFor("POST", { origin: "https://evil.example" })),
      /boklisten\.no/,
    );
  });

  test("rejects a state-changing request that names no origin", async ({ assert }) => {
    await assert.rejects(() => runMiddleware(contextFor("DELETE")), /boklisten\.no/);
  });

  test("falls back to the Referer when the browser omits Origin", async ({ assert }) => {
    assert.isTrue(
      await runMiddleware(contextFor("PATCH", { referer: `${OUR_ORIGIN}/admin/kasse?kunde=1` })),
    );
    await assert.rejects(
      () => runMiddleware(contextFor("PATCH", { referer: "https://evil.example/page" })),
      /boklisten\.no/,
    );
  });

  test("exempts the routes other servers call without an Origin", async ({ assert }) => {
    assert.isTrue(await runMiddleware(contextFor("POST", {}, "/webhooks/sendgrid")));
    assert.isTrue(await runMiddleware(contextFor("POST", {}, "/checkout/vipps/callback")));
    await assert.rejects(
      () => runMiddleware(contextFor("POST", {}, "/auth/local/login")),
      /boklisten\.no/,
    );
  });
});

test.group("requestOrigin()", () => {
  test("prefers Origin, reduces Referer to its origin and tolerates garbage", ({ assert }) => {
    assert.equal(
      requestOrigin({ origin: OUR_ORIGIN, referer: "https://other.example/" }),
      OUR_ORIGIN,
    );
    assert.equal(
      requestOrigin({ referer: "https://boklisten.no/items?x=1" }),
      "https://boklisten.no",
    );
    assert.isNull(requestOrigin({ referer: "not a url" }));
    assert.isNull(requestOrigin({}));
  });
});
