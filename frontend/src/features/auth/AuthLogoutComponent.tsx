import { useEffect } from "react";

import useAuth from "@/shared/hooks/useAuth";

export default function AuthLogoutComponent() {
  const { logout } = useAuth();
  useEffect(() => {
    logout();
  }, [logout]);

  return null;
}
