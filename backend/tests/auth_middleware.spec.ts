import { HttpContextFactory } from "@adonisjs/core/factories/http";
import { test } from "@japa/runner";
import jwt from "jsonwebtoken";

import NotAllowedException from "#exceptions/not_allowed_exception";
import UnauthorizedException from "#exceptions/unauthorized_exception";
import AuthMiddleware from "#middleware/auth_middleware";
import { APP_CONFIG } from "#services/application_config";
import type { UserPermission } from "#shared/user-permission";
import env from "#start/env";

function accessToken(permission: UserPermission, detailsId = "detail1") {
  return jwt.sign(
    {
      iss: APP_CONFIG.token.access.iss,
      aud: APP_CONFIG.token.access.aud,
      permission,
      details: detailsId,
    },
    env.get("ACCESS_TOKEN_SECRET"),
    { expiresIn: "1h" },
  );
}

function contextWithToken(token?: string) {
  const ctx = new HttpContextFactory().create();
  if (token !== undefined) {
    ctx.request.request.headers.authorization = `Bearer ${token}`;
  }
  return ctx;
}

test.group("AuthMiddleware", () => {
  test("rejects a request without a bearer token", async ({ assert }) => {
    const ctx = contextWithToken();
    let nextCalled = false;
    await assert.rejects(
      () => new AuthMiddleware().handle(ctx, () => Promise.resolve((nextCalled = true))),
      UnauthorizedException,
    );
    assert.isFalse(nextCalled);
  });

  test("rejects a token signed with another secret", async ({ assert }) => {
    const forged = jwt.sign({ permission: "admin", details: "x" }, "not-the-secret");
    await assert.rejects(
      () => new AuthMiddleware().handle(contextWithToken(forged), () => Promise.resolve()),
      UnauthorizedException,
    );
  });

  test("rejects a user below the required permission", async ({ assert }) => {
    const ctx = contextWithToken(accessToken("customer"));
    await assert.rejects(
      () => new AuthMiddleware().handle(ctx, () => Promise.resolve(), { permission: "employee" }),
      NotAllowedException,
    );
  });

  test("lets a higher permission through a lower requirement", async ({ assert }) => {
    const ctx = contextWithToken(accessToken("admin", "boss"));
    let nextCalled = false;
    await new AuthMiddleware().handle(ctx, () => Promise.resolve((nextCalled = true)), {
      permission: "employee",
    });
    assert.isTrue(nextCalled);
    assert.deepEqual(ctx.authUser, { detailsId: "boss", permission: "admin" });
  });

  test("exposes the authenticated user on the context when no level is required", async ({
    assert,
  }) => {
    const ctx = contextWithToken(accessToken("customer", "kid"));
    await new AuthMiddleware().handle(ctx, () => Promise.resolve());
    assert.deepEqual(ctx.authUser, { detailsId: "kid", permission: "customer" });
  });
});
