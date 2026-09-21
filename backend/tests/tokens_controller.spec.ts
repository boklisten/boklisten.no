import { HttpContextFactory } from "@adonisjs/core/factories/http";
import testUtils from "@adonisjs/core/services/test_utils";
import { test } from "@japa/runner";
import jwt from "jsonwebtoken";

import TokensController from "#controllers/auth/tokens_controller";
import User from "#models/user";
import env from "#start/env";
import { createUser } from "#tests/user_fixtures";

const EMAIL = "employee@boklisten.no";

function createRefreshToken() {
  return jwt.sign(
    { iss: "boklisten.no", aud: "boklisten.no", username: EMAIL },
    env.get("REFRESH_TOKEN_SECRET"),
    { expiresIn: "1h" },
  );
}

test.group("TokensController.refresh()", (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test("mints an access token with the user's current permission", async ({ assert }) => {
    const user = await createUser({ email: EMAIL, permission: "employee" });

    const ctx = new HttpContextFactory().create();
    ctx.request.updateBody({ refreshToken: createRefreshToken() });

    const tokens = await new TokensController().refresh(ctx);

    assert.isDefined(tokens);
    if (!tokens || !("accessToken" in tokens)) {
      throw new Error("expected token() to return an access token");
    }
    const accessTokenBody = jwt.verify(tokens.accessToken, env.get("ACCESS_TOKEN_SECRET"));
    assert.isObject(accessTokenBody);
    if (typeof accessTokenBody === "string") {
      throw new TypeError("expected a decoded token payload");
    }
    assert.equal(accessTokenBody["permission"], "employee");
    assert.equal(accessTokenBody["details"], user.id);
    assert.equal(accessTokenBody.sub, user.blid);
    assert.isNotNull((await User.findOrFail(user.id)).lastTokenIssuedAt);
  });

  test("responds unauthorized when the user no longer exists", async ({ assert }) => {
    const ctx = new HttpContextFactory().create();
    ctx.request.updateBody({ refreshToken: createRefreshToken() });

    const tokens = await new TokensController().refresh(ctx);

    assert.isUndefined(tokens);
    assert.equal(ctx.response.getStatus(), 401);
  });

  test("responds unauthorized for a refresh token with an invalid signature", async ({
    assert,
  }) => {
    await createUser({ email: EMAIL });
    const ctx = new HttpContextFactory().create();
    ctx.request.updateBody({
      refreshToken: jwt.sign({ username: EMAIL }, "wrong-secret", {
        expiresIn: "1h",
      }),
    });

    const tokens = await new TokensController().refresh(ctx);

    assert.isUndefined(tokens);
    assert.equal(ctx.response.getStatus(), 401);
  });
});
