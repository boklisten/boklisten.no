import type { UserPermission } from "@boklisten/backend/shared/user-permission";

export const PERMISSION_LABELS: Record<UserPermission, string> = {
  customer: "Kunde",
  employee: "Ansatt",
  manager: "Manager",
  admin: "Administrator",
};
