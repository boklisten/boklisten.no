import type { HttpContext } from "@adonisjs/core/http";
import vine from "@vinejs/vine";

import { StorageService } from "#services/storage_service";
import TokenService from "#services/token_service";
import { UserDetailService } from "#services/user_detail_service";
import { UserService } from "#services/user_service";
import { localAuthValidator, registerValidator } from "#validators/auth_validators";
import hash from "@adonisjs/core/services/hash";

export default class LocalController {
  async login({ request }: HttpContext) {
    const { username, password } = await request.validateUsing(localAuthValidator);

    const userDetail = vine.helpers.isEmail(username)
      ? await UserDetailService.getByEmail(username)
      : await UserDetailService.getByPhoneNumber(username);
    const user = await UserService.getByUserDetailsId(userDetail?.id);

    if (!userDetail) {
      return {
        message:
          "Brukernavnet du har oppgitt er ikke tilknyttet noen bruker. Du kan forsøke et annet brukernavn, eller lage en ny bruker ved å trykke på 'registrer deg'",
      };
    }

    if (!user?.login.local) {
      return {
        message:
          "Brukeren du forsøker å logge inn med har ikke satt opp passord-innlogging. Du kan forsøke å logge inn med Vipps, eller et lage et nytt passord ved å trykke på 'glemt passord'",
      };
    }
    const isCorrectPassword = await hash.verify(user.login.local.hashedPassword, password);

    if (!isCorrectPassword) {
      return {
        message:
          "Passordet du har oppgitt stemmer ikke. Du kan prøve et annet passord, eller et lage et nytt ved å trykke på 'glemt passord'",
      };
    }
    await StorageService.Users.update(user.id, {
      $set: {
        "login.local.lastLogin": new Date(),
      },
    });
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
    const userDetail = await UserDetailService.createLocalUserDetail(registerData);
    const user = await UserService.createLocalUser(userDetail.id, registerData.password);
    return await TokenService.createTokens(user);
  }
}
