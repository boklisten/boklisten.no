import { Stack, Tabs, Title } from "@mantine/core";
import { IconUserCog, IconUsers } from "@tabler/icons-react";
import { getRouteApi } from "@tanstack/react-router";

import CustomersTab from "@/features/user-management/CustomersTab";
import EmployeesTab from "@/features/user-management/EmployeesTab";

export const USER_MANAGER_TABS = ["kunder", "ansatte"] as const;
export type UserManagerTab = (typeof USER_MANAGER_TABS)[number];

export function parseUserManagerTab(value: unknown): UserManagerTab | undefined {
  return USER_MANAGER_TABS.includes(value as UserManagerTab)
    ? (value as UserManagerTab)
    : undefined;
}

const route = getRouteApi("/(administrasjon)/admin/database/brukere");

export default function UserManager() {
  const { brukerFane } = route.useSearch();
  const navigate = route.useNavigate();

  return (
    <Stack>
      <Title>Brukere</Title>
      <Tabs
        value={brukerFane ?? "kunder"}
        onChange={(value) =>
          void navigate({
            search: (previous) => ({ ...previous, brukerFane: parseUserManagerTab(value) }),
            replace: true,
          })
        }
        keepMounted={false}
      >
        <Tabs.List mb={"md"}>
          <Tabs.Tab value={"kunder"} leftSection={<IconUsers />}>
            Kunder
          </Tabs.Tab>
          <Tabs.Tab value={"ansatte"} leftSection={<IconUserCog />}>
            Ansatte
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value={"kunder"}>
          <CustomersTab />
        </Tabs.Panel>
        <Tabs.Panel value={"ansatte"}>
          <EmployeesTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
