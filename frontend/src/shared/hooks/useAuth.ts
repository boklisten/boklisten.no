import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { hasPermissionLevel } from "@boklisten/backend/shared/user-permission";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { authQueryOptions } from "@/features/auth/authQuery";
import { apiClient } from "@/shared/utils/apiClient";

export default function useAuth() {
  const queryClient = useQueryClient();
  const { data } = useQuery(authQueryOptions());
  const user = data ?? null;

  async function logout() {
    try {
      await apiClient.api.auth.logout({});
    } catch {
      // The session cookie may already be gone; the local state is cleared either way.
    }
    sessionStorage.clear();
    localStorage.clear();
    queryClient.clear();
    queryClient.setQueryData(authQueryOptions().queryKey, null);
  }

  return {
    user,
    logout,
    detailsId: user?.id ?? null,
    isLoggedIn: user !== null,
    isEmployee: user !== null && hasPermissionLevel(user.permission, "employee"),
    isManager: user !== null && hasPermissionLevel(user.permission, "manager"),
    isAdmin: user !== null && hasPermissionLevel(user.permission, "admin"),
    canAccess: (requiredPermission: UserPermission) =>
      user !== null && hasPermissionLevel(user.permission, requiredPermission),
  };
}
