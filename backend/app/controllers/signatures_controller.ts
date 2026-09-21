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

function formatSignedDate(dateTime: DateTime | null): string | undefined {
  if (!dateTime) {
    return undefined;
  }
  return dateTime.toFormat("dd/MM/yyyy");
}

async function getSignatureStatus(detailsId: string) {
  const userDetail = await User.find(detailsId);
  if (!userDetail) {
    return null;
  }

  await reconcileSignatureTask(userDetail);
  const newestSignature = await Signature.newestForCustomer(userDetail.id);
  if (newestSignature?.isValidFor(userDetail)) {
    return {
      image: newestSignature.image.toString("base64"),
      isSignatureValid: true,
      signatureRequired: false,
      signedByGuardian: newestSignature.signedByGuardian,
      signingName: newestSignature.signingName,
      signedAtText: formatSignedDate(newestSignature.createdAt),
      expiresAtText: formatSignedDate(newestSignature.expiresAtFor(userDetail)),
    };
  }

  return {
    isSignatureValid: false,
    signatureRequired: userDetail.taskSignAgreement,
    // A guardian signature the customer has outgrown is shown until they sign for themselves.
    outgrownGuardianSignature: newestSignature?.isOutgrownGuardianFor(userDetail)
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
    return getSignatureStatus(ctx.request.param("detailsId"));
  }
  async me(ctx: HttpContext) {
    return getSignatureStatus(ctx.authUser.detailsId);
  }
  async sendLink(ctx: HttpContext) {
    const targetDetailsId = ctx.request.param("detailsId");

    const userDetail = await User.find(targetDetailsId);
    const branch = await Branch.findOptional(userDetail?.branchMembershipId);
    if (userDetail) {
      await DispatchService.sendSignatureLink(userDetail, branch?.name ?? "en filial");
    }
  }
  async sendLinkMe(ctx: HttpContext) {
    const { detailsId } = ctx.authUser;

    const userDetail = await User.find(detailsId);
    const branch = await Branch.findOptional(userDetail?.branchMembershipId);
    if (userDetail) {
      await DispatchService.sendSignatureLink(userDetail, branch?.name ?? "en filial");
    }
  }
  async valid(ctx: HttpContext) {
    const detailsId = ctx.request.param("detailsId");
    const userDetail = await User.find(detailsId);
    if (!userDetail) {
      return {
        isSignatureValid: false,
        message:
          "Lenken er ugyldig. Vennligst prøv igjen, eller ta kontakt hvis problemet vedvarer.",
      };
    }
    const validSignature = await Signature.validForCustomer(userDetail);
    if (validSignature) {
      return {
        isSignatureValid: true,
        name: userDetail.name,
        signedByGuardian: validSignature.signedByGuardian,
        signingName: validSignature.signingName,
        signedAtText: formatSignedDate(validSignature.createdAt),
        expiresAtText: formatSignedDate(validSignature.expiresAtFor(userDetail)),
      };
    }

    // Tell a customer who has turned 18 why they are asked to sign again. The guardian's
    // signature itself stays private to the admin view.
    const newestSignature = await Signature.newestForCustomer(userDetail.id);
    return {
      isSignatureValid: false,
      name: userDetail.name,
      isUnderage: isUnderage(userDetail),
      outgrownGuardianSignature: newestSignature?.isOutgrownGuardianFor(userDetail)
        ? {
            signingName: newestSignature.signingName,
            signedAtText: formatSignedDate(newestSignature.createdAt),
          }
        : null,
    };
  }
  async sign(ctx: HttpContext) {
    const { base64EncodedImage, signingName } = await ctx.request.validateUsing(signValidator);
    const detailsId = ctx.request.param("detailsId");
    const userDetail = await User.find(detailsId);
    if (
      !userDetail ||
      (isUnderage(userDetail) && signingName === userDetail.name) ||
      (await userHasValidSignature(userDetail))
    ) {
      ctx.response.badRequest();
      return;
    }
    const image = await new Transformer(Buffer.from(base64EncodedImage, "base64")).webp(10);
    await Signature.create({
      customerDetailsId: userDetail.id,
      signingName: isUnderage(userDetail) ? signingName : userDetail.name,
      signedByGuardian: isUnderage(userDetail),
      image,
    });
    userDetail.taskSignAgreement = false;
    await userDetail.save();
  }
}
