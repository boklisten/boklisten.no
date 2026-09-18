import { Anchor, Group } from "@mantine/core";
import { IconPhone, IconUser } from "@tabler/icons-react";

import CustomerLink from "@/features/kasse/CustomerLink";

export default function AdminMatchContact({
  customerId,
  name,
  phone,
}: {
  customerId: string;
  name: string;
  phone: string;
}) {
  return (
    <Group gap="lg">
      <Group gap={5}>
        <IconUser />
        <CustomerLink detailsId={customerId} fw={400}>
          {name}
        </CustomerLink>
      </Group>
      {phone && (
        <Group gap={5}>
          <IconPhone />
          <Anchor href={`tel:${phone}`}>{phone}</Anchor>
        </Group>
      )}
    </Group>
  );
}
