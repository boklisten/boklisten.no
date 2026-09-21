import { Bouncer, errors } from "@adonisjs/bouncer";
import { HttpContextFactory } from "@adonisjs/core/factories/http";
import type { HttpContext } from "@adonisjs/core/http";
import { test } from "@japa/runner";

import * as abilities from "#abilities/main";
import CanMiddleware from "#middleware/can_middleware";
import type { UserPermission } from "#shared/user-permission";
import { hasPermissionLevel } from "#shared/user-permission";
import { userDouble } from "#tests/user_fixtures";

function contextFor(permission: UserPermission | null): HttpContext {
  const ctx = new HttpContextFactory().create();
  const user = permission === null ? null : userDouble({ permission });
  ctx.bouncer = new Bouncer(() => user, abilities);
  return ctx;
}

async function runMiddleware(ctx: HttpContext, permission: UserPermission): Promise<boolean> {
  let nextCalled = false;
  await new CanMiddleware().handle(
    ctx,
    () => {
      nextCalled = true;
      return Promise.resolve();
    },
    { permission },
  );
  return nextCalled;
}

test.group("CanMiddleware", () => {
  test("lets the exact level and every higher level through", async ({ assert }) => {
    assert.isTrue(await runMiddleware(contextFor("employee"), "employee"));
    assert.isTrue(await runMiddleware(contextFor("admin"), "employee"));
    assert.isTrue(await runMiddleware(contextFor("admin"), "customer"));
  });

  test("stops a lower level with a 403", async ({ assert }) => {
    const failure = await runMiddleware(contextFor("employee"), "admin").then(
      () => null,
      (error: unknown) => error,
    );
    if (!(failure instanceof errors.E_AUTHORIZATION_FAILURE)) {
      throw new Error("expected an authorization failure");
    }
    assert.equal(failure.status, 403);
  });

  test("stops a guest without consulting the ability", async ({ assert }) => {
    await assert.rejects(
      () => runMiddleware(contextFor(null), "customer"),
      errors.E_AUTHORIZATION_FAILURE,
    );
  });
});

test.group("hasPermissionLevel()", () => {
  test("orders customer < employee < admin", ({ assert }) => {
    assert.isTrue(hasPermissionLevel("admin", "employee"));
    assert.isTrue(hasPermissionLevel("employee", "employee"));
    assert.isFalse(hasPermissionLevel("employee", "admin"));
    assert.isFalse(hasPermissionLevel("customer", "employee"));
  });
});
