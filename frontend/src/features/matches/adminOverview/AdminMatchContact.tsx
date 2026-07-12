import { Anchor, Group, Text } from "@mantine/core";
import { IconPhone, IconUser } from "@tabler/icons-react";

export default function AdminMatchContact({ name, phone }: { name: string; phone: string }) {
  return (
    <Group gap={"lg"}>
      <Group gap={5}>
        <IconUser />
        <Text>{name}</Text>
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
