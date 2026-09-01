import type { AccessToken } from "@boklisten/backend/shared/access-token";
import { PERMISSION_LEVELS } from "@boklisten/backend/shared/user-permission";
import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { decodeToken } from "react-jwt";

import useLocalStorageSubscription from "@/shared/hooks/useLocalStorageSubscription";
import BL_CONFIG from "@/shared/utils/bl-config";

export function login(tokens: { accessToken: string; refreshToken: string }) {
  if (!decodeToken(tokens.accessToken) || !decodeToken(tokens.refreshToken)) {
    return false;
  }
  localStorage.setItem(BL_CONFIG.token.accessToken, tokens.accessToken);
  localStorage.setItem(BL_CONFIG.token.refreshToken, tokens.refreshToken);
  return true;
}

export function logout() {
  sessionStorage.clear();
  localStorage.clear();
}

export default function useAuth() {
  const accessToken = useLocalStorageSubscription(BL_CONFIG.token.accessToken);
  const decodedAccessToken = decodeToken<AccessToken>(accessToken ?? "");

  const permissionLevel = decodedAccessToken
    ? PERMISSION_LEVELS[decodedAccessToken.permission]
    : -1;

  return {
    detailsId: decodedAccessToken?.details ?? null,
    isLoading: accessToken === null,
    isLoggedIn: permissionLevel >= PERMISSION_LEVELS.customer,
    isEmployee: permissionLevel >= PERMISSION_LEVELS.employee,
    isManager: permissionLevel >= PERMISSION_LEVELS.manager,
    isAdmin: permissionLevel >= PERMISSION_LEVELS.admin,
    canAccess: (requiredPermission: UserPermission) =>
      permissionLevel >= PERMISSION_LEVELS[requiredPermission],
  };
}
