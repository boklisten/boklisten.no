import { Alert } from "@mantine/core";
import { IconEye } from "@tabler/icons-react";
import type { ReactNode } from "react";

import useAuth from "@/shared/hooks/useAuth";

/**
 * Tells the employee that what they are about to do is reported to the administrator. Mirrors the
 * backend's EmployeeMonitoringService: admins are exempt, so they get a neutral line saying that
 * the action is monitored for employees, rather than the warning. Put it in the confirm step of
 * every monitored action, with the sentence written for that action.
 */
export default function MonitoringNotice({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (isAdmin) {
    return (
      <Alert icon={<IconEye />} color="gray" variant="light" title="Overvåket handling">
        Ansatte som gjør dette, varsles til administrator.
      </Alert>
    );
  }
  return (
    <Alert icon={<IconEye />} color="yellow" variant="light">
      {children}
    </Alert>
  );
}
