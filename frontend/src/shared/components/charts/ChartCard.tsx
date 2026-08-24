import { Card, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export default function ChartCard({
  title,
  description,
  isEmpty,
  children,
}: {
  title: string;
  description?: string;
  isEmpty?: boolean;
  children: ReactNode;
}) {
  return (
    <Card withBorder padding={"lg"} radius={"md"} h={"100%"}>
      <Stack gap={"xs"} h={"100%"}>
        <Stack gap={2}>
          <Title order={3}>{title}</Title>
          {description && (
            <Text size={"sm"} c={"dimmed"}>
              {description}
            </Text>
          )}
        </Stack>
        {isEmpty ? (
          <Text c={"dimmed"} fs={"italic"} py={"xl"} ta={"center"}>
            Ingen data å vise
          </Text>
        ) : (
          children
        )}
      </Stack>
    </Card>
  );
}
