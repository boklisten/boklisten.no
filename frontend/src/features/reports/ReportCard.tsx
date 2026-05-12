import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconFileDownload } from "@tabler/icons-react";
import type { ReactNode } from "react";

interface ReportCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  isLoading: boolean;
  onDownload: () => void;
  downloadLabel?: string;
}

export default function ReportCard({
  title,
  description,
  children,
  isLoading,
  onDownload,
  downloadLabel = "Last ned rapport",
}: ReportCardProps) {
  return (
    <Card withBorder padding={"lg"} radius={"md"}>
      <Stack gap={"md"}>
        <Stack gap={"xs"}>
          <Title order={2}>{title}</Title>
          {description && (
            <Text size={"sm"} c={"dimmed"}>
              {description}
            </Text>
          )}
        </Stack>
        <Stack gap={"md"}>{children}</Stack>
        <Group justify={"flex-end"}>
          <Button
            leftSection={<IconFileDownload size={18} />}
            loading={isLoading}
            onClick={onDownload}
          >
            {downloadLabel}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
