import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";

import { APP_CONFIG } from "#services/legacy/application-config";
import { StorageService } from "#services/storage_service";
import env from "#start/env";
import type { User } from "#types/user";

const TokenService = {
  async createTokens(user: User) {
    const userDetail = await StorageService.UserDetails.getOrNull(user.userDetail);
    await StorageService.Users.update(user.id, {
      $set: {
        "login.lastTokenIssuedAt": new Date(),
      },
    });

    const PAYLOAD = {
      iss: APP_CONFIG.token.access.iss,
      aud: APP_CONFIG.token.access.aud,
      iat: Math.floor(Date.now() / 1000),
      sub: userDetail?.blid,
      username: userDetail?.email,
    } as const satisfies JwtPayload;
    const EXPIRY = {
      expiresIn: APP_CONFIG.token.refresh.expiresIn,
    } as const;

    return {
      accessToken: jwt.sign(
        {
          ...PAYLOAD,
          permission: user.permission,
          details: user.userDetail,
        },
        env.get("ACCESS_TOKEN_SECRET"),
        EXPIRY,
      ),
      refreshToken: jwt.sign(PAYLOAD, env.get("REFRESH_TOKEN_SECRET"), EXPIRY),
    };
  },
};
export default TokenService;
