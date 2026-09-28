import type { HttpContext } from "@adonisjs/core/http";
import { Transformer } from "@napi-rs/image";
import type { DateTime } from "luxon";

import Branch from "#models/branch";
import Signature, { isUnderage } from "#models/signature";
import User from "#models/user";
import DispatchService from "#services/dispatch_service";
import { reconcileSignatureTask, userHasValidSignature } from "#services/signature_helper";
import { SignatureGalleryService } from "#services/signature_gallery_service";
import { signValidator } from "#validators/signature";

function formatSignedDate(dateTime: DateTime): string {
  return dateTime.toFormat("dd/MM/yyyy");
}

async function getSignatureStatus(userId: string) {
  const user = await User.find(userId);
  if (!user) {
    return null;
  }

  await reconcileSignatureTask(user);
  const newestSignature = await Signature.newestForCustomer(user.id, { withImage: true });
  if (newestSignature?.isValidFor(user)) {
    return {
      image: newestSignature.image.toString("base64"),
      isSignatureValid: true,
      signatureRequired: false,
      signedByGuardian: newestSignature.signedByGuardian,
      signingName: newestSignature.signingName,
      signedAtText: formatSignedDate(newestSignature.createdAt),
      expiresAtText: formatSignedDate(newestSignature.expiresAtFor(user)),
    };
  }

  return {
    isSignatureValid: false,
    signatureRequired: user.taskSignAgreement,
    // A guardian signature the customer has outgrown is shown until they sign for themselves.
    outgrownGuardianSignature: newestSignature?.isOutgrownGuardianFor(user)
      ? {
          image: newestSignature.image.toString("base64"),
          signingName: newestSignature.signingName,
          signedAtText: formatSignedDate(newestSignature.createdAt),
        }
      : null,
  };
}

export default class SignaturesController {
  async gallery(ctx: HttpContext) {
    const cursor = SignatureGalleryService.decodeCursor(ctx.request.input("cursor"));
    return SignatureGalleryService.getPage(cursor);
  }
  async show(ctx: HttpContext) {
    return getSignatureStatus(ctx.request.param("userId"));
  }
  async me(ctx: HttpContext) {
    return getSignatureStatus(ctx.auth.getUserOrFail().id);
  }
  async sendLink(ctx: HttpContext) {
    const targetUserId = ctx.request.param("userId");

    const user = await User.find(targetUserId);
    const branch = await Branch.findOptional(user?.branchMembershipId);
    if (user) {
      await DispatchService.sendSignatureLink(user, branch?.name ?? "en filial");
    }
  }
  async sendLinkMe(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail();
    const branch = await Branch.findOptional(user.branchMembershipId);
    await DispatchService.sendSignatureLink(user, branch?.name ?? "en filial");
  }
  async valid(ctx: HttpContext) {
    const userId = ctx.request.param("userId");
    const user = await User.find(userId);
    if (!user) {
      return {
        isSignatureValid: false,
        message:
          "Lenken er ugyldig. Vennligst prøv igjen, eller ta kontakt hvis problemet vedvarer.",
      };
    }
    const validSignature = await Signature.validForCustomer(user);
    if (validSignature) {
      return {
        isSignatureValid: true,
        name: user.name,
        signedByGuardian: validSignature.signedByGuardian,
        signingName: validSignature.signingName,
        signedAtText: formatSignedDate(validSignature.createdAt),
        expiresAtText: formatSignedDate(validSignature.expiresAtFor(user)),
      };
    }

    // Tell a customer who has turned 18 why they are asked to sign again. The guardian's
    // signature itself stays private to the admin view.
    const newestSignature = await Signature.newestForCustomer(user.id);
    return {
      isSignatureValid: false,
      name: user.name,
      isUnderage: isUnderage(user),
      outgrownGuardianSignature: newestSignature?.isOutgrownGuardianFor(user)
        ? {
            signingName: newestSignature.signingName,
            signedAtText: formatSignedDate(newestSignature.createdAt),
          }
        : null,
    };
  }
  async sign(ctx: HttpContext) {
    const { base64EncodedImage, signingName } = await ctx.request.validateUsing(signValidator);
    const userId = ctx.request.param("userId");
    const user = await User.find(userId);
    if (
      !user ||
      (isUnderage(user) && signingName === user.name) ||
      (await userHasValidSignature(user))
    ) {
      ctx.response.badRequest();
      return;
    }
    const image = await new Transformer(Buffer.from(base64EncodedImage, "base64")).webp(10);
    await Signature.create({
      customerId: user.id,
      signingName: isUnderage(user) ? signingName : (user.name ?? signingName),
      signedByGuardian: isUnderage(user),
      image,
    });
    user.taskSignAgreement = false;
    await user.save();
  }
}
