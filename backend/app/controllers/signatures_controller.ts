import type { HttpContext } from "@adonisjs/core/http";
import { Transformer } from "@napi-rs/image";
import type { DateTime } from "luxon";

import Signature, { isUnderage } from "#models/signature";
import DispatchService from "#services/dispatch_service";
import { DateService } from "#services/legacy/date.service";
import { reconcileSignatureTask, userHasValidSignature } from "#services/legacy/signature.helper";
import { PermissionService } from "#services/permission_service";
import { SignatureGalleryService } from "#services/signature_gallery_service";
import { StorageService } from "#services/storage_service";
import { signValidator } from "#validators/signature";

function formatSignedDate(dateTime: DateTime | null): string | undefined {
  if (!dateTime) {
    return undefined;
  }
  return DateService.format(dateTime.toJSDate(), "Europe/Oslo", "DD/MM/YYYY");
}

async function getSignatureStatus(detailsId: string) {
  let userDetail = await StorageService.UserDetails.getOrNull(detailsId);
  if (!userDetail) {
    return null;
  }

  userDetail = await reconcileSignatureTask(userDetail);
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
    signatureRequired: userDetail.tasks?.signAgreement === true,
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
    PermissionService.adminOrFail(ctx);
    const cursor = SignatureGalleryService.decodeCursor(ctx.request.input("cursor"));
    return SignatureGalleryService.getPage(cursor);
  }
  async getSignature(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    return getSignatureStatus(ctx.request.param("detailsId"));
  }
  async getMySignature(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);
    return getSignatureStatus(detailsId);
  }
  async sendSignatureLink(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);
    const targetDetailsId = ctx.request.param("detailsId");

    const userDetail = await StorageService.UserDetails.getOrNull(targetDetailsId);
    const branch = await StorageService.Branches.getOrNull(userDetail?.branchMembership);
    if (userDetail) {
      await DispatchService.sendSignatureLink(userDetail, branch?.name ?? "en filial");
    }
  }
  async sendSignatureLinkAsCustomer(ctx: HttpContext) {
    const { detailsId } = PermissionService.authenticate(ctx);

    const userDetail = await StorageService.UserDetails.getOrNull(detailsId);
    const branch = await StorageService.Branches.getOrNull(userDetail?.branchMembership);
    if (userDetail) {
      await DispatchService.sendSignatureLink(userDetail, branch?.name ?? "en filial");
    }
  }
  async hasValidSignature(ctx: HttpContext) {
    const detailsId = ctx.request.param("detailsId");
    const userDetail = await StorageService.UserDetails.getOrNull(detailsId);
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
    const userDetail = await StorageService.UserDetails.getOrNull(detailsId);
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
    await StorageService.UserDetails.update(userDetail.id, {
      "tasks.signAgreement": false,
    });
  }
}
