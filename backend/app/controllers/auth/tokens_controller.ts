import type { HttpContext } from "@adonisjs/core/http";
import jwt from "jsonwebtoken";

import TokenService from "#services/token_service";
import { UserDetailService } from "#services/user_detail_service";
import { UserService } from "#services/user_service";
import env from "#start/env";
import { tokenValidator } from "#validators/auth_validators";

async function getUserFromVerifiedRefreshToken(verifiedRefreshToken: jwt.JwtPayload) {
  const userDetail = await UserDetailService.getByEmail(verifiedRefreshToken["username"]);
  return UserService.getByUserDetailsId(userDetail?.id);
}

export default class TokensController {
  async token(ctx: HttpContext) {
    const { refreshToken } = await ctx.request.validateUsing(tokenValidator);
    try {
      const verifiedRefreshToken = jwt.verify(refreshToken, env.get("REFRESH_TOKEN_SECRET"));

      if (typeof verifiedRefreshToken === "string") {
        return ctx.response.unauthorized();
      }

      const user = await getUserFromVerifiedRefreshToken(verifiedRefreshToken);
      if (!user) {
        return ctx.response.unauthorized();
      }
      const tokens = await TokenService.createTokens(user);

      if (!tokens) {
        return ctx.response.unauthorized();
      }

      return tokens;
    } catch {
      return ctx.response.unauthorized();
    }
  }
}
