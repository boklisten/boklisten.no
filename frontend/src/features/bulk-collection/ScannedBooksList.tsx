import type { ScannedBook } from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { Badge, Button, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconUsers } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { formatDeadline, isOverdue } from "@/features/bulk-collection/deadline";
import EntityLink from "@/shared/components/EntityLink";

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={0} miw={0}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="sm" component="div">
        {children}
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
            <Stack gap="sm">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Text fw={600} lh={1.3}>
                  {book.title}
                </Text>
                <Button
                  variant="subtle"
                  color="red"
                  size="compact-sm"
                  style={{ flexShrink: 0 }}
                  onClick={() => onRemove(book.blid)}
                >
                  Fjern
                </Button>
              </Group>

              {book.deliverToName !== undefined && (
                <Badge
                  color="blue"
                  variant="light"
                  tt="none"
                  w="fit-content"
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

              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" verticalSpacing="xs">
                <DetailItem label="Unik ID">
                  <EntityLink
                    to="/admin/kasse"
                    search={{ blid: book.blid }}
                    size="sm"
                    ff="monospace"
                    aria-label={`Se historikken til bok ${book.blid}`}
                  >
                    {book.blid}
                  </EntityLink>
                </DetailItem>
                <DetailItem label="Lånt av">
                  <EntityLink to="/admin/kasse" search={{ kunde: book.customerId }} size="sm">
                    {book.customerName}
                  </EntityLink>
                </DetailItem>
                <DetailItem label="Utdelt på">{book.handoutBranchName}</DetailItem>
                <DetailItem label="Frist">
                  {overdue ? (
                    // The deadline is the fact that is wrong, so the warning sits on it rather
                    // than in a separate badge saying the same thing.
                    <Group component="span" gap={4} wrap="nowrap" c="red" fw={600}>
                      <IconAlertTriangle size={14} aria-hidden style={{ flexShrink: 0 }} />
                      <span style={{ whiteSpace: "nowrap" }}>
                        {formatDeadline(book.deadline)} · utløpt
                      </span>
                    </Group>
                  ) : (
                    formatDeadline(book.deadline)
                  )}
                </DetailItem>
              </SimpleGrid>
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
