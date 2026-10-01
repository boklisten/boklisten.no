import { IconLogout } from "@tabler/icons-react";

import TanStackButton from "@/shared/components/TanStackButton";

/** The way out, at the foot of both sites' menus: the one red button there. */
export default function LogoutButton({ onNavigate }: { onNavigate: () => void }) {
  return (
    <TanStackButton
      to="/auth/logout"
      variant="subtle"
      color="red"
      fullWidth
      leftSection={<IconLogout size={18} />}
      onClick={onNavigate}
    >
      Logg ut
    </TanStackButton>
  );
}
