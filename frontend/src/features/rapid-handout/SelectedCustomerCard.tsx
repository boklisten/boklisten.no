import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import {
  ActionIcon,
  Avatar,
  Badge,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconMail, IconPencil, IconPhone, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import UnlockUserMatchesButton from "@/features/matches/UnlockUserMatchesButton";
import initials from "@/features/rapid-handout/initials";
import PermissionBadge from "@/features/rapid-handout/PermissionBadge";
import AdministrateUserForm from "@/features/user/AdministrateUserForm";
import useApiClient from "@/shared/hooks/useApiClient";

const ADMINISTRATE_USER_MODAL_ID = "administrate-user";

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
    <Paper withBorder radius={"md"} p={"md"}>
      <Stack gap={"sm"}>
        <Group justify={"space-between"} align={"flex-start"} wrap={"nowrap"} gap={"xs"}>
          <Group gap={"sm"} align={"center"} wrap={"nowrap"} miw={0}>
            <Avatar color={"brand"} radius={"xl"}>
              {initials(customer.name)}
            </Avatar>
            <Stack gap={4} miw={0}>
              <Title order={2} size={"h4"} lh={1.2}>
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
          <Group gap={4} wrap={"nowrap"}>
            <Tooltip label={"Rediger brukerdetaljer"}>
              <ActionIcon
                variant={"subtle"}
                color={"gray"}
                size={"lg"}
                aria-label={"Rediger brukerdetaljer"}
                onClick={() =>
                  modals.open({
                    modalId: ADMINISTRATE_USER_MODAL_ID,
                    title: "Rediger brukerdetaljer",
                    children: (
                      <Stack>
                        <UnlockUserMatchesButton userDetailId={customer.id} />
                        <AdministrateUserForm
                          userDetail={customer}
                          onSaved={() => modals.close(ADMINISTRATE_USER_MODAL_ID)}
                        />
                      </Stack>
                    ),
                  })
                }
              >
                <IconPencil size={20} aria-hidden />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={"Fjern valgt kunde"}>
              <ActionIcon
                variant={"subtle"}
                color={"gray"}
                size={"lg"}
                aria-label={"Fjern valgt kunde"}
                onClick={onDeselect}
              >
                <IconX size={20} aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Group>
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
      </Stack>
    </Paper>
  );
}
