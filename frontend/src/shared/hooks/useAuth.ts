import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { hasPermissionLevel } from "@boklisten/backend/shared/user-permission";
import { hashKey, useQuery, useQueryClient } from "@tanstack/react-query";

import { authQueryOptions } from "@/features/auth/authQuery";
import { apiClient } from "@/shared/utils/apiClient";

export default function useAuth() {
  const queryClient = useQueryClient();
  const { data } = useQuery(authQueryOptions());
  const user = data ?? null;

  /**
   * Optimistic: the browser is a guest at once while the server call finishes behind. The auth
   * query is answered in place so every mounted `useAuth` flips together; the rest of the cache
   * goes so the next login cannot show this user's responses. Once the server has agreed, the
   * answer is put down again, over anything a refetch may have picked up in the meantime.
   */
  async function logout() {
    const key = authQueryOptions().queryKey;
    const serverLogout = apiClient.api.auth.logout({}).catch(() => {
      // The session cookie may already be gone; the local state is cleared either way.
    });
    sessionStorage.clear();
    localStorage.clear();
    queryClient.removeQueries({ predicate: (query) => query.queryHash !== hashKey(key) });
    queryClient.setQueryData(key, null);
    await serverLogout;
    await queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData(key, null);
  }

  return {
    user,
    logout,
    userId: user?.id ?? null,
    isLoggedIn: user !== null,
    isEmployee: user !== null && hasPermissionLevel(user.permission, "employee"),
    isAdmin: user !== null && hasPermissionLevel(user.permission, "admin"),
    canAccess: (requiredPermission: UserPermission) =>
      user !== null && hasPermissionLevel(user.permission, requiredPermission),
  };
}
