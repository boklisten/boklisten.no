import { Group } from "@mantine/core";
import type { BadgeProps } from "@mantine/core";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

import classes from "@/features/layout/nav/Nav.module.css";
import { firstName, isActive } from "@/features/layout/public-nav/publicNavigation";
import type { FileRouteTypes } from "@/routeTree.gen";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import IdentityBadge from "@/features/user/IdentityBadge";
import type { IdentitySite } from "@/features/user/IdentityBadge";
import IdentityAvatar from "@/features/user/IdentityAvatar";
import useAuth from "@/shared/hooks/useAuth";

/**
 * Who is logged in, as bl-admin shows a customer: avatar, first name, then one chip for what
 * matters on that site (see `IdentityAvatar`, `IdentityBadge`). It is the menu's first section, "Din bruker", laid out
 * like the sections below it: the identity row stands where their rows stand and is the one way to
 * the user's own settings, marked by colour while that page is open. Anything else about the
 * account (the public site's pending tasks) follows the row inside the section. Nothing for a
 * guest; the site shows its ways in instead.
 */
export default function IdentityHead({
  settingsTo,
  site,
  badgeSize = "sm",
  onNavigate,
  children,
}: {
  settingsTo: FileRouteTypes["to"];
  site: IdentitySite;
  /** Smaller in the narrow sidebar, so the chip still fits beside the avatar. */
  badgeSize?: BadgeProps["size"];
  onNavigate: () => void;
  children?: ReactNode;
}) {
  const { user } = useAuth();
  const pathname = useLocation({ select: (location) => location.pathname });
  if (!user) {
    return null;
  }
  const name = firstName(user);
  const active = isActive({ to: settingsTo }, pathname);
  return (
    <div className={classes.group}>
      <p className={classes.groupTitle}>Din bruker</p>
      <TanStackAnchor
        to={settingsTo}
        className={classes.identityLink}
        underline="never"
        aria-label={`${name}: brukerinnstillinger`}
        data-active={active || undefined}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
      >
        <IdentityAvatar user={user} name={user.name ?? name} site={site} />
        <span className={classes.identityText}>
          <span className={classes.identityName}>{name}</span>
          <Group gap={6} className={classes.identityBadges}>
            <IdentityBadge user={user} site={site} size={badgeSize} />
          </Group>
        </span>
      </TanStackAnchor>
      {children}
    </div>
  );
}
