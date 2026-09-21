import { BaseCommand, args } from "@adonisjs/core/ace";
import type { CommandOptions } from "@adonisjs/core/types/ace";

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
    const User = (await import("#models/user")).default;
    const TokenService = (await import("#services/token_service")).default;

    const user = await User.byUsername(this.username);
    if (!user) {
      this.logger.error(`No user found for "${this.username}"`);
      this.exitCode = 1;
      return;
    }

    const tokens = await TokenService.createTokens(user);
    const url = new URL("/auth/token", env.get("CLIENT_URI"));
    url.searchParams.set("access_token", tokens.accessToken);
    url.searchParams.set("refresh_token", tokens.refreshToken);

    this.logger.info(`user: ${user.email} (permission: ${user.permission})`);
    this.logger.log(url.toString());
  }
}
