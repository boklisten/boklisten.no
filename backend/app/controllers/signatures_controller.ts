import { HttpContext } from "@adonisjs/core/http";
import { Transformer } from "@napi-rs/image";
import moment from "moment-timezone";

import DispatchService from "#services/dispatch_service";
import { DateService } from "#services/legacy/date.service";
import {
  getValidUserSignature,
  isUnderage,
  reconcileSignatureTask,
  userHasValidSignature,
} from "#services/legacy/signature.helper";
import { PermissionService } from "#services/permission_service";
import { StorageService } from "#services/storage_service";
import { SIGNATURE_NUM_MONTHS_VALID } from "#shared/serialized-signature";
import { signValidator } from "#validators/signature";

export default class SignaturesController {
  async getSignature(ctx: HttpContext) {
    PermissionService.employeeOrFail(ctx);

    const detailsId = ctx.request.param("detailsId");
    let userDetail = await StorageService.UserDetails.getOrNull(detailsId);
    if (!userDetail) return null;

    userDetail = await reconcileSignatureTask(userDetail);
    const validSignature = await getValidUserSignature(userDetail);
    if (validSignature) {
      return {
        image: validSignature.image,
        isSignatureValid: true,
        signatureRequired: false,
        signedByGuardian: validSignature.signedByGuardian,
        signingName: validSignature.signingName,
        signedAtText:
          validSignature.creationTime &&
          DateService.format(validSignature.creationTime, "Europe/Oslo", "DD/MM/YYYY"),
        expiresAtText: DateService.format(
          moment(validSignature.creationTime).add(SIGNATURE_NUM_MONTHS_VALID, "months").toDate(),
          "Europe/Oslo",
          "DD/MM/YYYY",
        ),
      };
    }

    return {
      isSignatureValid: false,
      signatureRequired: userDetail.tasks?.signAgreement === true,
    };
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
    const validSignature = await getValidUserSignature(userDetail);
    if (validSignature) {
      return {
        isSignatureValid: true,
        name: userDetail.name,
        signedByGuardian: validSignature.signedByGuardian,
        signingName: validSignature.signingName,
        signedAtText:
          validSignature.creationTime &&
          DateService.format(validSignature.creationTime, "Europe/Oslo", "DD/MM/YYYY"),
        expiresAtText: DateService.format(
          moment(validSignature.creationTime).add(SIGNATURE_NUM_MONTHS_VALID, "months").toDate(),
          "Europe/Oslo",
          "DD/MM/YYYY",
        ),
      };
    }

    return {
      isSignatureValid: false,
      name: userDetail.name,
      isUnderage: isUnderage(userDetail),
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
    const writtenSignature = await StorageService.Signatures.add({
      image,
      signingName: isUnderage(userDetail) ? signingName : userDetail.name,
      signedByGuardian: isUnderage(userDetail),
    });
    await StorageService.UserDetails.update(userDetail.id, {
      signatures: [...userDetail.signatures, writtenSignature.id],
      "tasks.signAgreement": false,
    });
  }
}
