import { BaseCommand, args } from "@adonisjs/core/ace";
import { CommandOptions } from "@adonisjs/core/types/ace";
import vine from "@vinejs/vine";

export default class MintLoginUrl extends BaseCommand {
  static override commandName = "mint:login-url";
  static override description =
    "Mint access/refresh tokens for a user and print a ready-to-use /auth/token login URL (local testing)";

  static override options: CommandOptions = {
    startApp: true,
  };

  @args.string({ description: "Email or phone number of the user to log in as" })
  declare username: string;

  override async run() {
    const env = (await import("#start/env")).default;
    if (env.get("API_ENV") === "production") {
      this.logger.error("Refusing to mint login URLs against production");
      this.exitCode = 1;
      return;
    }
    await import("#start/mongoose");
    const mongoose = (await import("mongoose")).default;
    const { UserDetailService } = await import("#services/user_detail_service");
    const { UserService } = await import("#services/user_service");
    const TokenService = (await import("#services/token_service")).default;

    try {
      const userDetail = vine.helpers.isEmail(this.username)
        ? await UserDetailService.getByEmail(this.username)
        : await UserDetailService.getByPhoneNumber(this.username);
      const user = await UserService.getByUserDetailsId(userDetail?.id);
      if (!userDetail || !user) {
        this.logger.error(`No user found for "${this.username}"`);
        this.exitCode = 1;
        return;
      }

      const tokens = await TokenService.createTokens(user);
      const url = new URL("/auth/token", env.get("CLIENT_URI"));
      url.searchParams.set("access_token", tokens.accessToken);
      url.searchParams.set("refresh_token", tokens.refreshToken);

      this.logger.info(`user: ${userDetail.email} (permission: ${user.permission})`);
      this.logger.log(url.toString());
    } finally {
      await mongoose.disconnect();
    }
  }
}
