import { Group } from "@mantine/core";
import type { BadgeProps } from "@mantine/core";
import type { ReactNode } from "react";

import { MenuSection } from "@/features/layout/nav/Menu";
import NavAnchor from "@/features/layout/nav/NavAnchor";
import classes from "@/features/layout/nav/Nav.module.css";
import { isNavLinkActive, usePathname } from "@/features/layout/nav/navigation";
import type { FileRouteTypes } from "@/routeTree.gen";
import { firstName } from "@/features/user/firstName";
import IdentityBadge from "@/features/user/IdentityBadge";
import type { IdentitySite } from "@/features/user/IdentityBadge";
import IdentityAvatar from "@/features/user/IdentityAvatar";
import useAuth from "@/shared/hooks/useAuth";

/**
 * Who is logged in, as bl-admin shows a customer: avatar, first name, then one chip for what
 * matters on that site (see `IdentityAvatar`, `IdentityBadge`). It is the menu's first section, "Din bruker", laid out
 * like the sections below it: the identity row stands where their rows stand and is the one way to
 * the user's own settings, marked by colour while that page is open. Anything else about the
 * account (the public site's pending tasks) follows the row inside the section. A guest gets the
 * site's ways in (`guest`) in the same place, or no section at all.
 */
export default function IdentityHead({
  settingsTo,
  site,
  badgeSize = "sm",
  onNavigate,
  guest,
  children,
}: {
  settingsTo: FileRouteTypes["to"];
  site: IdentitySite;
  /** Smaller in the narrow sidebar, so the chip still fits beside the avatar. */
  badgeSize?: BadgeProps["size"];
  onNavigate?: () => void;
  guest?: ReactNode;
  children?: ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user) {
    return guest ? <MenuSection title="Din bruker">{guest}</MenuSection> : null;
  }
  const name = firstName(user);
  const active = isNavLinkActive({ to: settingsTo }, pathname);
  return (
    <MenuSection title="Din bruker">
      <NavAnchor
        to={settingsTo}
        active={active}
        className={classes.identityLink}
        aria-label={`${name}: brukerinnstillinger`}
        onClick={onNavigate}
      >
        <IdentityAvatar user={user} name={user.name ?? name} site={site} />
        <span className={classes.identityText}>
          <span className={classes.identityName}>{name}</span>
          <Group gap={6} className={classes.identityBadges}>
            <IdentityBadge user={user} site={site} size={badgeSize} />
          </Group>
        </span>
      </NavAnchor>
      {children}
    </MenuSection>
  );
}
