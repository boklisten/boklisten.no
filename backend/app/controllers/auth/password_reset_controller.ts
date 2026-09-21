import type { HttpContext } from "@adonisjs/core/http";
import hash from "@adonisjs/core/services/hash";

import { DateTime } from "luxon";

import PasswordReset from "#models/password_reset";
import User from "#models/user";
import CryptoService from "#services/crypto_service";
import DispatchService from "#services/dispatch_service";
import { PasswordService } from "#services/password_service";
import { forgotPasswordValidator, passwordResetValidator } from "#validators/auth_validators";

async function getPasswordReset({ id, token }: { id: string; token: string }) {
  const passwordReset = await PasswordReset.query()
    .where("id", id)
    .where("createdAt", ">", DateTime.now().minus({ minutes: 30 }).toSQL())
    .first();

  if (!passwordReset) {
    return {
      message: `Lenken har utløpt. Du kan be om å få tilsendt en ny lenke på 'glemt passord'-siden`,
    };
  }

  try {
    await hash.assertEquals(passwordReset.tokenHash, token);
  } catch {
    return {
      message: `Lenken er ugyldig. Du kan be om å få tilsendt en ny lenke på 'glemt passord'-siden`,
    };
  }

  const user = await User.find(passwordReset.userDetailId);
  if (!user) {
    return {
      message: `Lenken er ugyldig. Du kan be om å få tilsendt en ny lenke på 'glemt passord'-siden`,
    };
  }

  return { user, passwordReset };
}

export default class PasswordResetController {
  async request({ request }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator);
    const token = CryptoService.random();
    const tokenHash = await hash.make(token);

    const user = await User.byEmail(email);
    if (!user) {
      return {
        message:
          "E-posten du har oppgitt er ikke tilknyttet noen bruker. Du kan forsøke et annet brukernavn, eller lage en ny bruker ved å trykke på 'registrer deg'",
      };
    }

    const passwordReset = await PasswordReset.create({
      userDetailId: user.id,
      tokenHash,
    });

    const mailStatus = await DispatchService.sendPasswordReset({
      id: passwordReset.id,
      email,
      token,
    });
    if (!mailStatus.success) {
      throw new Error("Klarte ikke sende glemt passord-lenke.");
    }
    return {};
  }

  async reset({ request }: HttpContext) {
    const {
      params: { id },
      token,
      newPassword,
    } = await request.validateUsing(passwordResetValidator);
    const result = await getPasswordReset({
      id,
      token,
    });

    if (!result.passwordReset) {
      return { message: `Klarte ikke sette nytt passord. ${result.message}` };
    }

    await PasswordService.setPassword(result.user, newPassword);

    await result.passwordReset.delete();
    return {};
  }

  async validate(ctx: HttpContext) {
    const id = ctx.request.param("id");
    const token = ctx.request.param("token");
    const result = await getPasswordReset({ id, token });
    if (!result.passwordReset) {
      return { message: result.message };
    }
    return {};
  }
}
