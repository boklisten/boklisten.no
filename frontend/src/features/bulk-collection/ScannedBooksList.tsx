import type { ScannedBook } from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconUsers } from "@tabler/icons-react";

import { formatDeadline, isOverdue } from "@/features/bulk-collection/deadline";

function DetailItem({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <Stack gap={0} miw={0}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="sm" c={valueColor} fw={valueColor ? 600 : undefined}>
        {value}
      </Text>
    </Stack>
  );
}

export default function ScannedBooksList({
  books,
  onRemove,
}: {
  books: ScannedBook[];
  onRemove: (blid: string) => void;
}) {
  return (
    <Stack gap="sm">
      {books.map((book) => {
        const overdue = isOverdue(book.deadline);
        return (
          <Card key={book.blid} withBorder radius="md" padding="sm">
            <Stack gap="xs">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Text fw={600}>{book.title}</Text>
                <Button
                  variant="subtle"
                  color="red"
                  size="compact-sm"
                  onClick={() => onRemove(book.blid)}
                >
                  Fjern
                </Button>
              </Group>

              {(book.deliverToName !== undefined || overdue) && (
                <Group gap="xs">
                  {book.deliverToName !== undefined && (
                    <Badge
                      color="blue"
                      variant="light"
                      tt="none"
                      leftSection={<IconUsers size={12} />}
                      // Student names must survive 375px, so the label wraps instead of truncating
                      styles={{
                        root: { height: "auto" },
                        label: { whiteSpace: "normal", lineHeight: 1.3 },
                      }}
                    >
                      Skulle egentlig til {book.deliverToName}
                    </Badge>
                  )}
                  {overdue && (
                    <Badge
                      color="red"
                      variant="filled"
                      leftSection={<IconAlertTriangle size={12} />}
                    >
                      Utløpt frist
                    </Badge>
                  )}
                </Group>
              )}

              <Group gap="xl">
                <DetailItem label="Lånt av" value={book.customerName} />
                <DetailItem label="Utdelt på" value={book.handoutBranchName} />
                <DetailItem
                  label="Frist"
                  value={formatDeadline(book.deadline)}
                  valueColor={overdue ? "red" : undefined}
                />
              </Group>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
