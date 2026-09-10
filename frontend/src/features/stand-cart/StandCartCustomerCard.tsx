import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Avatar, Group, Paper, Stack, Text, useMatches } from "@mantine/core";

import CustomerContactRow from "@/features/customer-search/CustomerContactRow";
import initials from "@/features/customer-search/initials";
import shortName from "@/features/customer-search/shortName";
import EntityLink from "@/shared/components/EntityLink";

/**
 * Whose cart this is, as a card across the top of every step, receipt included: the customer as
 * the Kunde card shows them, avatar and all, with the name leading to them in Kasse and the ways
 * of reaching them so two customers with the same name are told apart.
 */
export default function StandCartCustomerCard({
  customer,
  onNavigate,
}: {
  customer: UserDetail;
  /** The name was followed: the cart closes, since the customer is where the employee is going. */
  onNavigate: () => void;
}) {
  // Only the first and last name on a phone, as in the Kunde card
  const name = useMatches({ base: shortName(customer.name), sm: customer.name });
  return (
    // Labelled the way Kasse labels its Kunde card
    <Stack gap={6}>
      <Text fz="sm" fw={500} c="dimmed">
        Valgt kunde
      </Text>
      <Paper withBorder radius="md" px="md" py="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <Avatar color="brand" radius="xl">
            {initials(customer.name)}
          </Avatar>
          <Stack gap={4} miw={0}>
            <Text lh={1.2}>
              <EntityLink to="/admin/kasse" search={{ kunde: customer.id }} onClick={onNavigate}>
                {name}
              </EntityLink>
            </Text>
            <CustomerContactRow customer={customer} />
          </Stack>
        </Group>
      </Paper>
    </Stack>
  );
}
