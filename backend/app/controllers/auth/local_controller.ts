import type { HttpContext } from "@adonisjs/core/http";
import hash from "@adonisjs/core/services/hash";

import User from "#models/user";
import { LoginService } from "#services/login_service";
import { UserService } from "#services/user_service";
import { localAuthValidator, registerValidator } from "#validators/auth_validators";

export default class LocalController {
  /** Logs in with email or phone and password; the reply either starts a session or says why not. */
  async login(ctx: HttpContext) {
    const { username, password } = await ctx.request.validateUsing(localAuthValidator);

    const user = await User.byUsername(username);

    if (!user) {
      return {
        message:
          "Brukernavnet du har oppgitt er ikke tilknyttet noen bruker. Du kan forsøke et annet brukernavn, eller lage en ny bruker ved å trykke på 'registrer deg'",
      };
    }

    if (user.localHashedPassword === null) {
      return {
        message:
          "Brukeren du forsøker å logge inn med har ikke satt opp passord-innlogging. Du kan forsøke å logge inn med Vipps, eller et lage et nytt passord ved å trykke på 'glemt passord'",
      };
    }
    const isCorrectPassword = await hash.verify(user.localHashedPassword, password);

    if (!isCorrectPassword) {
      return {
        message:
          "Passordet du har oppgitt stemmer ikke. Du kan prøve et annet passord, eller et lage et nytt ved å trykke på 'glemt passord'",
      };
    }
    await LoginService.login(ctx, user);

    return { user: await UserService.withTasksReconciled(user) };
  }

  async register(ctx: HttpContext) {
    const registerData = await ctx.request.validateUsing(registerValidator);
    const user = await UserService.createLocalUser(registerData);
    await LoginService.login(ctx, user);
    return UserService.withTasksReconciled(user);
  }
}
