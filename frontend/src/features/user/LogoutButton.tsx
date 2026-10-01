import { IconLogout } from "@tabler/icons-react";

import TanStackButton from "@/shared/components/TanStackButton";

/** The way out, at the foot of the user's own settings on both sites: the one red button there. */
export default function LogoutButton() {
  return (
    <TanStackButton
      to="/auth/logout"
      variant="subtle"
      color="red"
      fullWidth
      leftSection={<IconLogout size={18} />}
    >
      Logg ut
    </TanStackButton>
  );
}
