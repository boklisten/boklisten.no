import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import { DateTime } from "luxon";

import type User from "#models/user";
import { APP_CONFIG } from "#services/application_config";
import env from "#start/env";

const TokenService = {
  /**
   * Issues both tokens and saves the user with `lastTokenIssuedAt` set, so callers that record a
   * login (`localLastLogin`, the Vipps identity) set those fields first and let this save them.
   */
  async createTokens(user: User) {
    user.lastTokenIssuedAt = DateTime.now();
    await user.save();

    const PAYLOAD = {
      iss: APP_CONFIG.token.access.iss,
      aud: APP_CONFIG.token.access.aud,
      iat: Math.floor(Date.now() / 1000),
      sub: user.blid,
      username: user.email,
    } as const satisfies JwtPayload;
    const EXPIRY = {
      expiresIn: APP_CONFIG.token.refresh.expiresIn,
    } as const;

    return {
      accessToken: jwt.sign(
        {
          ...PAYLOAD,
          permission: user.permission,
          details: user.id,
        },
        env.get("ACCESS_TOKEN_SECRET"),
        EXPIRY,
      ),
      refreshToken: jwt.sign(PAYLOAD, env.get("REFRESH_TOKEN_SECRET"), EXPIRY),
    };
  },
};
export default TokenService;
