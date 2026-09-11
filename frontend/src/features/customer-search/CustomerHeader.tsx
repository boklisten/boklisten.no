import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { ActionIcon, Anchor, Avatar, Badge, Group, Stack, Title, Tooltip } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconPencil, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import CustomerContactRow from "@/features/customer-search/CustomerContactRow";
import initials from "@/features/customer-search/initials";
import PermissionBadge from "@/features/customer-search/PermissionBadge";
import useDisplayName from "@/features/customer-search/useDisplayName";
import AdministrateUserForm from "@/features/user/AdministrateUserForm";
import EntityLink from "@/shared/components/EntityLink";
import { openCustomerIdModal } from "@/shared/components/ShowCustomerIdButton";
import useApiClient from "@/shared/hooks/useApiClient";

const ADMINISTRATE_USER_MODAL_ID = "administrate-user";

/** Who the customer is and the actions on them; the top of the Kunde card, like BlidBookHeader. */
export default function CustomerHeader({
  customer,
  onDeselect,
  withDeselect = true,
  linkToKasse = false,
  withCustomerId = false,
  onMerged,
}: {
  customer: UserDetail & { permission: UserPermission };
  /** Called when the customer leaves the screen: the X here, or the customer being deleted. */
  onDeselect: () => void;
  /** The X that drops the customer; off where the page has its own way back. */
  withDeselect?: boolean;
  /** Makes the name a link to the customer in Kasse; off where Kasse is the page itself. */
  linkToKasse?: boolean;
  /** Makes the name open the customer's ID as a QR code; only in the customer view. */
  withCustomerId?: boolean;
  onMerged: (toDetailsId: string) => void;
}) {
  const { api } = useApiClient();
  const { data: branch } = useQuery(
    api.branches.getById.queryOptions(
      { params: { branchId: customer.branchMembership ?? "" } },
      { enabled: Boolean(customer.branchMembership) },
    ),
  );
  const displayName = useDisplayName();
  const name = (text: string) => {
    if (linkToKasse) {
      return (
        <EntityLink to="/admin/kasse" search={{ kunde: customer.id }} fw="inherit">
          {text}
        </EntityLink>
      );
    }
    if (withCustomerId) {
      return (
        <Anchor
          component="button"
          type="button"
          c="inherit"
          ff="inherit"
          fz="inherit"
          fw="inherit"
          lh="inherit"
          ta="left"
          underline="hover"
          onClick={() => openCustomerIdModal(customer.id)}
        >
          {text}
        </Anchor>
      );
    }
    return text;
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <Group gap="sm" align="center" wrap="nowrap" miw={0}>
          <Avatar color="brand" radius="xl">
            {initials(customer.name)}
          </Avatar>
          <Stack gap={4} miw={0}>
            <Title order={2} size="h4" lh={1.2}>
              {name(displayName(customer.name))}
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
