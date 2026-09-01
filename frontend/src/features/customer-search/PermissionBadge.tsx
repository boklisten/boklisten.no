import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { Badge } from "@mantine/core";
import type { BadgeProps } from "@mantine/core";

const PERMISSION_BADGES: Record<
  Exclude<UserPermission, "customer">,
  { label: string; color: string }
> = {
  employee: { label: "Ansatt", color: "blue" },
  manager: { label: "Manager", color: "grape" },
  admin: { label: "Administrator", color: "red" },
};

export default function PermissionBadge({
  permission,
  size,
}: {
  permission: UserPermission;
  size?: BadgeProps["size"];
}) {
  if (permission === "customer") {
    return null;
  }
  const { label, color } = PERMISSION_BADGES[permission];
  return (
    <Badge variant="filled" color={color} size={size}>
      {label}
    </Badge>
  );
}
