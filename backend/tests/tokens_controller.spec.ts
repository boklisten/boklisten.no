import { HttpContextFactory } from "@adonisjs/core/factories/http";
import { test } from "@japa/runner";
import jwt from "jsonwebtoken";
import sinon, { createSandbox } from "sinon";

import TokensController from "#controllers/auth/tokens_controller";
import { StorageService } from "#services/storage_service";
import { UserDetailService } from "#services/user_detail_service";
import { UserService } from "#services/user_service";
import { UserDetail } from "#shared/user-detail";
import env from "#start/env";
import { mock } from "#tests/test-doubles";
import { User } from "#types/user";

function createRefreshToken() {
  return jwt.sign(
    { iss: "boklisten.no", aud: "boklisten.no", username: "employee@boklisten.no" },
    env.get("REFRESH_TOKEN_SECRET"),
    { expiresIn: "1h" },
  );
}

test.group("TokensController.token()", (group) => {
  let sandbox: sinon.SinonSandbox;

  group.each.setup(() => {
    sandbox = createSandbox();
    sandbox
      .stub(UserDetailService, "getByEmail")
      .resolves(mock<UserDetail>({ id: "detail1", blid: "u#abc", email: "employee@boklisten.no" }));
    sandbox
      .stub(StorageService.UserDetails, "getOrNull")
      .resolves(mock<UserDetail>({ id: "detail1", blid: "u#abc", email: "employee@boklisten.no" }));
    sandbox.stub(StorageService.Users, "update").resolves(mock<User>({}));
    return () => sandbox.restore();
  });

  test("mints an access token with the user's current permission", async ({ assert }) => {
    sandbox
      .stub(UserService, "getByUserDetailsId")
      .resolves(mock<User>({ id: "user1", userDetail: "detail1", permission: "employee" }));

    const ctx = new HttpContextFactory().create();
    ctx.request.updateBody({ refreshToken: createRefreshToken() });

    const tokens = await new TokensController().token(ctx);

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
    assert.equal(accessTokenBody["details"], "detail1");
  });

  test("responds unauthorized when the user no longer exists", async ({ assert }) => {
    sandbox.stub(UserService, "getByUserDetailsId").resolves(null);

    const ctx = new HttpContextFactory().create();
    ctx.request.updateBody({ refreshToken: createRefreshToken() });

    const tokens = await new TokensController().token(ctx);

    assert.isUndefined(tokens);
    assert.equal(ctx.response.getStatus(), 401);
  });

  test("responds unauthorized for a refresh token with an invalid signature", async ({
    assert,
  }) => {
    sandbox.stub(UserService, "getByUserDetailsId").resolves(null);

    const ctx = new HttpContextFactory().create();
    ctx.request.updateBody({
      refreshToken: jwt.sign({ username: "employee@boklisten.no" }, "wrong-secret", {
        expiresIn: "1h",
      }),
    });

    const tokens = await new TokensController().token(ctx);

    assert.isUndefined(tokens);
    assert.equal(ctx.response.getStatus(), 401);
  });
});
