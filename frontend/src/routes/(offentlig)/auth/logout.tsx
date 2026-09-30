import { IconLogout } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent } from "react";

import useAuth from "@/shared/hooks/useAuth";
import { showSuccessNotification } from "@/shared/utils/notifications";

/** Not a page: logs the visitor out and sends them straight to the front page with a word that it happened. */
export const Route = createFileRoute("/(offentlig)/auth/logout")({
  component: Logout,
});

function Logout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const onMount = useEffectEvent(() => {
    void logout();
    showSuccessNotification({
      id: "logged-out",
      message: "Du er nå logget ut.",
      icon: <IconLogout size={18} />,
    });
    void navigate({ to: "/", replace: true });
  });
  useEffect(() => {
    onMount();
  }, []);
  return null;
}
