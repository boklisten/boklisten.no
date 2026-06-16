import type { ScannedBook } from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { Badge, Button, Card, Group, Stack, Text, ThemeIcon, Tooltip } from "@mantine/core";
import { IconAlertTriangle, IconArrowRight, IconLock } from "@tabler/icons-react";

import { formatDeadline, isOverdue } from "@/features/bulk-collection/deadline";

const LOCKED_TOOLTIP =
  "Denne boka er låst til en overlevering og kan ikke leveres på stand — eleven må overlevere den til en annen elev.";

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
      <Text size={"xs"} c={"dimmed"} tt={"uppercase"} fw={600}>
        {label}
      </Text>
      <Text size={"sm"} c={valueColor} fw={valueColor ? 600 : undefined}>
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
    <Stack gap={"sm"}>
      {books.map((book) => {
        const overdue = isOverdue(book.deadline);
        return (
          <Card
            key={book.blid}
            withBorder
            radius={"md"}
            padding={"sm"}
            style={book.lockedToMatch ? { borderColor: "var(--mantine-color-red-5)" } : undefined}
          >
            <Stack gap={"xs"}>
              <Group justify={"space-between"} wrap={"nowrap"} align={"flex-start"}>
                <Group gap={"sm"} wrap={"nowrap"} align={"center"} miw={0}>
                  {book.lockedToMatch && (
                    <Tooltip label={LOCKED_TOOLTIP} multiline w={260}>
                      <ThemeIcon color={"red"} variant={"light"} size={"lg"} radius={"xl"}>
                        <IconLock size={22} />
                      </ThemeIcon>
                    </Tooltip>
                  )}
                  <Text fw={600}>{book.title}</Text>
                </Group>
                <Button
                  variant={"subtle"}
                  color={"red"}
                  size={"compact-sm"}
                  onClick={() => onRemove(book.blid)}
                >
                  Fjern
                </Button>
              </Group>

              {(book.lockedToMatch || overdue) && (
                <Group gap={"xs"}>
                  {book.lockedToMatch && (
                    <Badge color={"red"} variant={"light"} leftSection={<IconLock size={12} />}>
                      Låst til overlevering
                    </Badge>
                  )}
                  {overdue && (
                    <Badge
                      color={"red"}
                      variant={"filled"}
                      leftSection={<IconAlertTriangle size={12} />}
                    >
                      Utløpt frist
                    </Badge>
                  )}
                </Group>
              )}

              {book.lockedToMatch && (
                <Group gap={6} wrap={"nowrap"} align={"center"} c={"red"}>
                  <IconArrowRight size={18} />
                  <Text size={"sm"} fw={600}>
                    Skal ikke leveres her – eleven må gi boka til{" "}
                    {book.deliverToName ?? "en annen elev"}
                  </Text>
                </Group>
              )}

              <Group gap={"xl"}>
                <DetailItem label={"Lånt av"} value={book.customerName} />
                <DetailItem label={"Utdelt på"} value={book.handoutBranchName} />
                <DetailItem
                  label={"Frist"}
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
