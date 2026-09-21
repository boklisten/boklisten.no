import type { HttpContext } from "@adonisjs/core/http";
import hash from "@adonisjs/core/services/hash";
import { DateTime } from "luxon";

import User from "#models/user";
import TokenService from "#services/token_service";
import { UserService } from "#services/user_service";
import { localAuthValidator, registerValidator } from "#validators/auth_validators";

export default class LocalController {
  async login({ request }: HttpContext) {
    const { username, password } = await request.validateUsing(localAuthValidator);

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
    user.localLastLogin = DateTime.now();
    const tokens = await TokenService.createTokens(user);
    if (!tokens) {
      return {
        message:
          "Klarte ikke logge deg inn. Vennligst prøv igjen eller ta kontakt dersom problemet vedvarer",
      };
    }

    return {
      tokens,
    };
  }

  async register({ request }: HttpContext) {
    const registerData = await request.validateUsing(registerValidator);
    const user = await UserService.createLocalUser(registerData);
    return TokenService.createTokens(user);
  }
}
