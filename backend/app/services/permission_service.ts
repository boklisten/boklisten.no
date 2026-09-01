import type { HttpContext } from "@adonisjs/core/http";
import jwt from "jsonwebtoken";

import NotAllowedException from "#exceptions/not_allowed_exception";
import UnauthorizedException from "#exceptions/unauthorized_exception";
import { APP_CONFIG } from "#services/legacy/application-config";
import type { BlDocument } from "#shared/bl-document";
import type { UserPermission } from "#shared/user-permission";
import { USER_PERMISSION } from "#shared/user-permission";
import env from "#start/env";
import type { BlDocumentPermission } from "#types/bl-collection";

function isAdmin(userPermission: UserPermission | null) {
  return userPermission === USER_PERMISSION.ADMIN;
}

function haveRestrictedDocumentPermission(
  userId: string,
  userPermission: UserPermission,
  document: BlDocument,
  documentPermission?: BlDocumentPermission,
): boolean {
  if (document.user?.id === userId || isPermissionOver(userPermission, document.user?.permission)) {
    return true;
  }

  if (documentPermission?.viewableForPermission) {
    return isPermissionEqualOrOver(userPermission, documentPermission.viewableForPermission);
  }

  return false;
}

function isPermissionEqualOrOver(
  permission: UserPermission,
  restrictedPermission: UserPermission,
): boolean {
  return permission === restrictedPermission
    ? true
    : isPermissionOver(permission, restrictedPermission);
}

function isPermissionOver(
  permission?: UserPermission,
  restrictedPermission?: UserPermission,
): boolean {
  if (!restrictedPermission || !permission) {
    return false;
  }
  const { CUSTOMER, EMPLOYEE, MANAGER, ADMIN } = USER_PERMISSION;

  if (permission === EMPLOYEE && restrictedPermission === CUSTOMER) {
    return true;
  }

  if (
    permission === MANAGER &&
    (restrictedPermission === EMPLOYEE || restrictedPermission === CUSTOMER)
  ) {
    return true;
  }

  return (
    permission === ADMIN &&
    (restrictedPermission === MANAGER ||
      restrictedPermission === EMPLOYEE ||
      restrictedPermission === CUSTOMER)
  );
}

function extractBearerToken(authHeader?: string) {
  if (!authHeader) {
    return "";
  }
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return "";
  }
  return token;
}

function verifyAccessToken(token: string) {
  const decoded = jwt.verify(token, env.get("ACCESS_TOKEN_SECRET"), {
    issuer: APP_CONFIG.token.access.iss,
    audience: APP_CONFIG.token.access.aud,
  });
  if (typeof decoded === "string") {
    throw new Error("token is not a valid jwt");
  }
  return decoded;
}

/**
 * @deprecated use Permission_service.authenticate() instead
 *
 */
function authenticateLegacy({ request }: HttpContext) {
  const authHeader = request.headers().authorization;
  return verifyAccessToken(extractBearerToken(authHeader));
}

/**
 *
 * @throws UnauthorizedException if token is not valid
 * @throws NotAllowedException if user does not have permission
 * @returns the detailsId and permission for the customer
 */
function authenticate({ request }: HttpContext, requiredPermission?: UserPermission) {
  const authHeader = request.headers().authorization;
  let permission: UserPermission;
  let detailsId: string;
  try {
    const accessToken = verifyAccessToken(extractBearerToken(authHeader));
    permission = accessToken["permission"];
    detailsId = accessToken["details"];
  } catch {
    throw new UnauthorizedException();
  }
  if (requiredPermission && !isPermissionEqualOrOver(permission, requiredPermission)) {
    throw new NotAllowedException();
  }
  return { permission, detailsId };
}

/**
 *
 * @throws UnauthorizedException if token is not valid
 * @throws NotAllowedException if user is not admin
 * @returns the detailsId and permission for the customer
 */
function adminOrFail(ctx: HttpContext) {
  return authenticate(ctx, USER_PERMISSION.ADMIN);
}

/**
 *
 * @throws UnauthorizedException if token is not valid
 * @throws NotAllowedException if user is not manager
 * @returns the detailsId and permission for the customer
 */
function managerOrFail(ctx: HttpContext) {
  return authenticate(ctx, USER_PERMISSION.MANAGER);
}

/**
 *
 * @throws UnauthorizedException if token is not valid
 * @throws NotAllowedException if user is not employee
 * @returns the detailsId and permission for the customer
 */
function employeeOrFail(ctx: HttpContext) {
  return authenticate(ctx, USER_PERMISSION.EMPLOYEE);
}

export const PermissionService = {
  isAdmin,
  haveRestrictedDocumentPermission,
  isPermissionEqualOrOver,
  isPermissionOver,
  authenticateLegacy,
  authenticate,
  adminOrFail,
  managerOrFail,
  employeeOrFail,
};
