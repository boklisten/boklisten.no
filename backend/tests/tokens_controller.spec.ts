import { HttpContextFactory } from "@adonisjs/core/factories/http";
import { test } from "@japa/runner";
import jwt from "jsonwebtoken";
import sinon, { createSandbox } from "sinon";

import TokensController from "#controllers/auth/tokens_controller";
import { StorageService } from "#services/storage_service";
import { UserDetailService } from "#services/user_detail_service";
import { UserService } from "#services/user_service";
import env from "#start/env";

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
    sandbox.stub(UserDetailService, "getByEmail").resolves({
      id: "detail1",
      blid: "u#abc",
      email: "employee@boklisten.no",
      // oxlint-disable-next-line no-explicit-any
    } as any);
    sandbox.stub(StorageService.UserDetails, "getOrNull").resolves({
      id: "detail1",
      blid: "u#abc",
      email: "employee@boklisten.no",
      // oxlint-disable-next-line no-explicit-any
    } as any);
    // oxlint-disable-next-line no-explicit-any
    sandbox.stub(StorageService.Users, "update").resolves({} as any);
    return () => sandbox.restore();
  });

  test("mints an access token with the user's current permission", async ({ assert }) => {
    sandbox.stub(UserService, "getByUserDetailsId").resolves({
      id: "user1",
      userDetail: "detail1",
      permission: "employee",
      // oxlint-disable-next-line no-explicit-any
    } as any);

    const ctx = new HttpContextFactory().create();
    ctx.request.updateBody({ refreshToken: createRefreshToken() });

    const tokens = await new TokensController().token(ctx);

    assert.isDefined(tokens);
    const accessTokenBody = jwt.verify(tokens!.accessToken, env.get("ACCESS_TOKEN_SECRET"));
    assert.isObject(accessTokenBody);
    assert.equal((accessTokenBody as jwt.JwtPayload)["permission"], "employee");
    assert.equal((accessTokenBody as jwt.JwtPayload)["details"], "detail1");
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
