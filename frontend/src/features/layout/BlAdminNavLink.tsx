import { NavLink } from "@mantine/core";
import type { NavLinkProps } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";

import TanStackAnchor from "@/shared/components/TanStackAnchor";

/**
 * The employee entry point into bl-admin. Rendered in the public navigation
 * drawer and on the frontpage so both places share one look and one copy.
 */
export default function BlAdminNavLink(props: Omit<NavLinkProps, "label" | "description">) {
  return (
    <NavLink
      label="Gå til bl-admin"
      description="Her kan du søke opp kunder, samle inn og dele ut bøker."
      to="/admin"
      leftSection={<IconExternalLink />}
      component={TanStackAnchor}
      active
      color="orange"
      underline="never"
      {...props}
    />
  );
}
