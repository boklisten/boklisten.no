import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { ActionIcon, Avatar, Badge, Group, Stack, Title, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconPencil, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import CustomerContactRow from "@/features/customer-search/CustomerContactRow";
import initials from "@/features/customer-search/initials";
import PermissionBadge from "@/features/customer-search/PermissionBadge";
import shortName from "@/features/customer-search/shortName";
import AdministrateUserForm from "@/features/user/AdministrateUserForm";
import EntityLink from "@/shared/components/EntityLink";
import useApiClient from "@/shared/hooks/useApiClient";

const ADMINISTRATE_USER_MODAL_ID = "administrate-user";

/** Who the customer is and the actions on them; the top of the Kunde card, like BlidBookHeader. */
export default function CustomerHeader({
  customer,
  onDeselect,
  withDeselect = true,
  linkToKasse = false,
  onMerged,
}: {
  customer: UserDetail & { permission: UserPermission };
  /** Called when the customer leaves the screen: the X here, or the customer being deleted. */
  onDeselect: () => void;
  /** The X that drops the customer; off where the page has its own way back. */
  withDeselect?: boolean;
  /** Makes the name a link to the customer in Kasse; off where Kasse is the page itself. */
  linkToKasse?: boolean;
  onMerged: (toDetailsId: string) => void;
}) {
  const { api } = useApiClient();
  const { data: branch } = useQuery(
    api.branches.getById.queryOptions(
      { params: { branchId: customer.branchMembership ?? "" } },
      { enabled: Boolean(customer.branchMembership) },
    ),
  );
  const name = (text: string) =>
    linkToKasse ? (
      <EntityLink to="/admin/kasse" search={{ kunde: customer.id }} fw="inherit">
        {text}
      </EntityLink>
    ) : (
      text
    );

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <Group gap="sm" align="center" wrap="nowrap" miw={0}>
          <Avatar color="brand" radius="xl">
            {initials(customer.name)}
          </Avatar>
          <Stack gap={4} miw={0}>
            {/* Only the first and last name on a phone, where the full name would wrap */}
            <Title order={2} size="h4" lh={1.2} hiddenFrom="sm">
              {name(shortName(customer.name))}
            </Title>
            <Title order={2} size="h4" lh={1.2} visibleFrom="sm">
              {name(customer.name)}
            </Title>
            {(Boolean(branch) || customer.permission !== "customer") && (
              <Group gap={6}>
                <PermissionBadge permission={customer.permission} />
                {branch && <Badge variant="light">{branch.name}</Badge>}
              </Group>
            )}
          </Stack>
        </Group>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Rediger brukerdetaljer">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label="Rediger brukerdetaljer"
              onClick={() =>
                modals.open({
                  modalId: ADMINISTRATE_USER_MODAL_ID,
                  title: "Rediger brukerdetaljer",
                  children: (
                    <AdministrateUserForm
                      userDetail={customer}
                      onSaved={() => modals.close(ADMINISTRATE_USER_MODAL_ID)}
                      onDeleted={() => {
                        modals.close(ADMINISTRATE_USER_MODAL_ID);
                        onDeselect();
                      }}
                      onMerged={(toDetailsId) => {
                        modals.close(ADMINISTRATE_USER_MODAL_ID);
                        onMerged(toDetailsId);
                      }}
                    />
                  ),
                })
              }
            >
              <IconPencil size={20} aria-hidden />
            </ActionIcon>
          </Tooltip>
          {withDeselect && (
            <Tooltip label="Fjern valgt kunde">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                aria-label="Fjern valgt kunde"
                onClick={onDeselect}
              >
                <IconX size={20} aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
      <CustomerContactRow customer={customer} />
    </Stack>
  );
}
