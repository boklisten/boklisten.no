import type { HttpContext } from "@adonisjs/core/http";
import jwt from "jsonwebtoken";

import User from "#models/user";
import TokenService from "#services/token_service";
import env from "#start/env";
import { tokenValidator } from "#validators/auth_validators";

export default class TokensController {
  async refresh(ctx: HttpContext) {
    const { refreshToken } = await ctx.request.validateUsing(tokenValidator);
    try {
      const verifiedRefreshToken = jwt.verify(refreshToken, env.get("REFRESH_TOKEN_SECRET"));

      if (typeof verifiedRefreshToken === "string") {
        return ctx.response.unauthorized();
      }

      const username: unknown = verifiedRefreshToken["username"];
      const user = typeof username === "string" ? await User.byEmail(username) : null;
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
