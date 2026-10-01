import type { User } from "@boklisten/backend/shared/user";
import { Badge } from "@mantine/core";
import type { BadgeProps } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import PermissionBadge from "@/features/customer-search/PermissionBadge";
import { api } from "@/shared/utils/apiClient";

/** Which site the user is on; it picks how they are shown (see `IdentityBadge`, `IdentityAvatar`). */
export type IdentitySite = "public" | "admin";

/**
 * The one chip that says who the user is on this site: their school on the public site, their
 * role in bl-admin. Nothing for a customer in bl-admin or a user without a school. Shared by the
 * menu's identity row and the settings page's header, so the two always agree.
 */
export default function IdentityBadge({
  user,
  site,
  size = "sm",
}: {
  user: Pick<User, "permission" | "branchMembershipId">;
  site: IdentitySite;
  size?: BadgeProps["size"];
}) {
  const { data: branch } = useQuery(
    api.branches.show.queryOptions(
      { params: { branchId: user.branchMembershipId ?? "" } },
      { enabled: site === "public" && Boolean(user.branchMembershipId) },
    ),
  );
  if (site === "admin") {
    return <PermissionBadge permission={user.permission} size={size} />;
  }
  return branch ? (
    <Badge variant="light" size={size}>
      {branch.name}
    </Badge>
  ) : null;
}
