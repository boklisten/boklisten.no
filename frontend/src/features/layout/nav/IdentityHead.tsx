import { Badge, Group } from "@mantine/core";
import type { BadgeProps } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";

import CustomerAvatar from "@/features/customer-search/CustomerAvatar";
import PermissionBadge from "@/features/customer-search/PermissionBadge";
import classes from "@/features/layout/nav/Nav.module.css";
import { firstName, isActive } from "@/features/layout/public-nav/publicNavigation";
import type { FileRouteTypes } from "@/routeTree.gen";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useAuth from "@/shared/hooks/useAuth";
import { api } from "@/shared/utils/apiClient";

/**
 * Who is logged in, as bl-admin shows a customer: avatar, first name, then their permission and
 * school. The whole row leads to the user's own settings and is marked like any other row while
 * that page is open. The head of both menu sheets and of the admin sidebar.
 */
export default function IdentityHead({
  settingsTo,
  badgeSize = "sm",
  onNavigate,
}: {
  settingsTo: FileRouteTypes["to"];
  /** Smaller in the narrow sidebar, so the permission still fits beside the avatar and the pen. */
  badgeSize?: BadgeProps["size"];
  onNavigate: () => void;
}) {
  const { user } = useAuth();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { data: branch } = useQuery(
    api.branches.show.queryOptions(
      { params: { branchId: user?.branchMembershipId ?? "" } },
      { enabled: Boolean(user?.branchMembershipId) },
    ),
  );
  if (!user) {
    return <div className={classes.identityName}>Meny</div>;
  }
  const name = firstName(user);
  const withBadges = Boolean(branch) || user.permission !== "customer";
  const active = isActive({ to: settingsTo }, pathname);
  return (
    <TanStackAnchor
      to={settingsTo}
      className={classes.identityLink}
      underline="never"
      aria-label={`${name}: brukerinnstillinger`}
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <CustomerAvatar userId={user.id} />
      <span className={classes.identityText}>
        <span className={classes.identityName}>{name}</span>
        {withBadges && (
          <Group gap={6} className={classes.identityBadges}>
            <PermissionBadge permission={user.permission} size={badgeSize} />
            {branch && (
              <Badge variant="light" size={badgeSize}>
                {branch.name}
              </Badge>
            )}
          </Group>
        )}
      </span>
      <IconPencil className={classes.identityEdit} size={20} aria-hidden />
    </TanStackAnchor>
  );
}
