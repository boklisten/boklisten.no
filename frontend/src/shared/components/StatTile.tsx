import { Card, Group, Text, ThemeIcon, Title } from "@mantine/core";
import type { ReactNode } from "react";

export default function StatTile({
  label,
  value,
  caption,
  icon,
  color,
}: {
  label: string;
  value: number;
  caption?: string;
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
          {caption && (
            <Text size={"xs"} c={"dimmed"}>
              {caption}
            </Text>
          )}
        </div>
      </Group>
    </Card>
  );
}
