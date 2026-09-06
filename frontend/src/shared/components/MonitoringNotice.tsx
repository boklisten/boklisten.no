import { Group, Text } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { ReactNode } from "react";

import useAuth from "@/shared/hooks/useAuth";

/**
 * Tells the employee that what they are about to do is reported to the administrator. Mirrors the
 * backend's EmployeeMonitoringService: admins are exempt, so they never see the line. Put it in
 * the confirm step of every monitored action, with the sentence written for that action.
 */
export default function MonitoringNotice({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (isAdmin) {
    return null;
  }
  return (
    <Group gap={6} wrap="nowrap" align="flex-start">
      <IconEye size={16} color="var(--mantine-color-yellow-7)" style={{ flex: "none" }} />
      <Text size="sm">{children}</Text>
    </Group>
  );
}
