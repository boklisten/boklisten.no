import type { HttpContext } from "@adonisjs/core/http";
import jwt from "jsonwebtoken";

import NotAllowedException from "#exceptions/not_allowed_exception";
import UnauthorizedException from "#exceptions/unauthorized_exception";
import { APP_CONFIG } from "#services/application_config";
import type { UserPermission } from "#shared/user-permission";
import { USER_PERMISSION } from "#shared/user-permission";
import env from "#start/env";

function isAdmin(userPermission: UserPermission | null) {
  return userPermission === USER_PERMISSION.ADMIN;
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
    throw new TypeError("token is not a valid jwt");
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
  isPermissionEqualOrOver,
  isPermissionOver,
  // Deliberately still exported for the legacy collection endpoints; the deprecation
  // marker is there to stop new usages
  // oxlint-disable-next-line typescript/no-deprecated
  authenticateLegacy,
  authenticate,
  adminOrFail,
  managerOrFail,
  employeeOrFail,
};
