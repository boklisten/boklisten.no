import { useEffect, useEffectEvent } from "react";

import useAuth from "@/shared/hooks/useAuth";

export default function AuthLogoutComponent() {
  const { logout } = useAuth();
  const onMount = useEffectEvent(() => void logout());
  useEffect(() => {
    onMount();
  }, []);

  return null;
}
