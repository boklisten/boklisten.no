import { Card, Group, Text, ThemeIcon, Title } from "@mantine/core";
import type { ReactNode } from "react";

export default function StatTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  color: string;
}) {
  return (
    <Card withBorder padding={"lg"} radius={"md"} h={"100%"}>
      <Group wrap={"nowrap"}>
        <ThemeIcon size={"xl"} radius={"md"} variant={"light"} color={color}>
          {icon}
        </ThemeIcon>
        <div>
          <Text size={"sm"} c={"dimmed"}>
            {label}
          </Text>
          <Title order={2}>{value.toLocaleString("nb-NO")}</Title>
        </div>
      </Group>
    </Card>
  );
}
