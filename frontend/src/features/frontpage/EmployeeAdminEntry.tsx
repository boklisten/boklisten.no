import { Activity } from "react";

import BlAdminNavLink from "@/features/layout/BlAdminNavLink";
import useAuth from "@/shared/hooks/useAuth";

export default function EmployeeAdminEntry() {
  const { isEmployee } = useAuth();
  return (
    <Activity mode={isEmployee ? "visible" : "hidden"}>
      <BlAdminNavLink w="100%" bdrs="md" bd="1px solid var(--mantine-color-orange-2)" />
    </Activity>
  );
}
