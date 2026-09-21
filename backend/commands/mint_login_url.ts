import { BaseCommand, args } from "@adonisjs/core/ace";
import type { CommandOptions } from "@adonisjs/core/types/ace";

export default class MintLoginUrl extends BaseCommand {
  static override commandName = "mint:login-url";
  static override description =
    "Print a one-time URL that logs the browser in as the given user (local testing)";

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
    const { DEV_LOGIN_TOKEN_PURPOSE } = await import("#controllers/auth/auth_controller");
    const encryption = (await import("@adonisjs/core/services/encryption")).default;
    const { apiOrigin } = await import("#config/app");

    const user = await User.byUsername(this.username);
    if (!user) {
      this.logger.error(`No user found for "${this.username}"`);
      this.exitCode = 1;
      return;
    }

    // The API route behind this link exists only outside production; it starts a session and
    // sends the browser on to the frontend.
    const token = encryption.encrypt({ userId: user.id }, "5 minutes", DEV_LOGIN_TOKEN_PURPOSE);
    const url = `${apiOrigin}/auth/dev_login/${encodeURIComponent(token)}`;

    this.logger.info(`user: ${user.email} (permission: ${user.permission})`);
    this.logger.log(url);
  }
}
