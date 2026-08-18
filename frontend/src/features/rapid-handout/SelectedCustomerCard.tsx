import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconMail, IconPhone, IconUserEdit, IconUserX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import UnlockUserMatchesButton from "@/features/matches/UnlockUserMatchesButton";
import PermissionBadge from "@/features/rapid-handout/PermissionBadge";
import AdministrateUserForm from "@/features/user/AdministrateUserForm";
import useApiClient from "@/shared/hooks/useApiClient";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export default function SelectedCustomerCard({
  customer,
  onDeselect,
}: {
  customer: UserDetail & { permission: UserPermission };
  onDeselect: () => void;
}) {
  const { api } = useApiClient();
  const { data: branch } = useQuery(
    api.branches.getById.queryOptions(
      { params: { branchId: customer.branchMembership ?? "" } },
      { enabled: Boolean(customer.branchMembership) },
    ),
  );

  return (
    <Paper withBorder radius={"md"} p={"lg"}>
      <Stack gap={"md"}>
        <Group justify={"space-between"} align={"flex-start"} wrap={"nowrap"} gap={"md"}>
          <Group gap={"md"} align={"center"} wrap={"nowrap"}>
            <Avatar color={"brand"} radius={"xl"} size={"lg"}>
              {initials(customer.name)}
            </Avatar>
            <Stack gap={6}>
              <Title order={2} size={"h3"} lh={1.2}>
                {customer.name}
              </Title>
              {(branch || customer.permission !== "customer") && (
                <Group gap={6}>
                  <PermissionBadge permission={customer.permission} />
                  {branch && <Badge variant={"light"}>{branch.name}</Badge>}
                </Group>
              )}
            </Stack>
          </Group>
          <Tooltip label={"Rediger brukerdetaljer"}>
            <ActionIcon
              variant={"subtle"}
              color={"gray"}
              size={"lg"}
              aria-label={"Rediger brukerdetaljer"}
              onClick={() =>
                modals.open({
                  title: "Rediger brukerdetaljer",
                  children: (
                    <Stack>
                      <UnlockUserMatchesButton userDetailId={customer.id} />
                      <AdministrateUserForm userDetail={customer} />
                    </Stack>
                  ),
                })
              }
            >
              <IconUserEdit size={20} aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Group gap={"md"} c={"dimmed"} style={{ rowGap: 4 }}>
          {customer.phone && (
            <Group gap={6} wrap={"nowrap"}>
              <IconPhone size={16} aria-hidden />
              <Text size={"sm"}>{customer.phone}</Text>
            </Group>
          )}
          {customer.email && (
            <Group gap={6} wrap={"nowrap"}>
              <IconMail size={16} aria-hidden />
              <Text size={"sm"} style={{ overflowWrap: "anywhere" }}>
                {customer.email}
              </Text>
            </Group>
          )}
        </Group>
        <Button
          variant={"light"}
          color={"gray"}
          leftSection={<IconUserX size={18} aria-hidden />}
          onClick={onDeselect}
          w={{ base: "100%", sm: "auto" }}
          style={{ alignSelf: "flex-start" }}
        >
          Fjern valgt kunde
        </Button>
      </Stack>
    </Paper>
  );
}
