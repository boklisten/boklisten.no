import type { CustomerCollectionReceipt } from "@boklisten/backend/shared/bulk-collection/bulk-collection-dtos";
import { Badge, Group, Paper, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import type { MantineColor } from "@mantine/core";
import type { Icon } from "@tabler/icons-react";
import {
  IconAlertTriangle,
  IconBook2,
  IconCalendar,
  IconCheck,
  IconPackageImport,
} from "@tabler/icons-react";

import bookCountLabel from "@/features/bulk-collection/bookCountLabel";
import { formatDeadline, isOverdue } from "@/features/bulk-collection/deadline";
import { showCustomerSearch } from "@/features/kasse/kasseParams";
import EntityLink from "@/shared/components/EntityLink";

interface ReceiptBook {
  title: string;
  deadline: string;
}

const byDeadline = (a: ReceiptBook, b: ReceiptBook) =>
  Date.parse(a.deadline) - Date.parse(b.deadline);

/** Books under their deadline, earliest first: a customer rarely has more than a few deadlines. */
function groupByDeadline(books: ReceiptBook[]): { deadline: string; titles: string[] }[] {
  const groups = new Map<string, { deadline: string; titles: string[] }>();
  for (const book of books.toSorted(byDeadline)) {
    const key = formatDeadline(book.deadline);
    const group = groups.get(key) ?? { deadline: book.deadline, titles: [] };
    group.titles.push(book.title);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * One tinted panel per outcome — what came in (green) and what the customer still has (grey) —
 * so the two are told apart at a glance. Inside, books sit under their deadline with a row icon
 * that repeats the outcome, and an expired deadline is flagged in red.
 */
function BookPanel({
  heading,
  icon: HeadingIcon,
  rowIcon: RowIcon,
  color,
  books,
}: {
  heading: string;
  icon: Icon;
  rowIcon: Icon;
  color: MantineColor;
  books: ReceiptBook[];
}) {
  return (
    <Paper radius="md" p="sm" bg={`${color}.0`} style={{ alignSelf: "start" }}>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Group gap={6} wrap="nowrap">
            <HeadingIcon size={18} aria-hidden color={`var(--mantine-color-${color}-8)`} />
            <Text size="sm" fw={600} c={`${color}.9`}>
              {heading}
            </Text>
          </Group>
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            {bookCountLabel(books.length)}
          </Text>
        </Group>
        {groupByDeadline(books).map(({ deadline, titles }) => {
          const overdue = isOverdue(deadline);
          return (
            <Stack key={deadline} gap={6}>
              <Group gap={6} wrap="nowrap">
                {overdue ? (
                  <IconAlertTriangle size={14} aria-hidden color="var(--mantine-color-red-7)" />
                ) : (
                  <IconCalendar size={14} aria-hidden color="var(--mantine-color-dimmed)" />
                )}
                <Text size="xs" fw={600} c={overdue ? "red.7" : "dimmed"}>
                  Frist {formatDeadline(deadline)}
                  {overdue && " · utløpt"}
                </Text>
              </Group>
              <Stack gap={4}>
                {titles.map((title, index) => (
                  <Group key={`${title}-${index}`} gap={8} wrap="nowrap" align="flex-start">
                    <ThemeIcon
                      size={20}
                      radius="xl"
                      variant="light"
                      color={color}
                      style={{ flexShrink: 0, marginTop: 1 }}
                    >
                      <RowIcon size={12} aria-hidden />
                    </ThemeIcon>
                    <Text size="sm" fw={500} lh={1.4}>
                      {title}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}

/** The deadline that matters now: the earliest one among everything the customer had on loan. */
function nextDeadline(receipt: CustomerCollectionReceipt): string | undefined {
  return [...receipt.collectedBooks, ...receipt.remainingBooks].toSorted(byDeadline)[0]?.deadline;
}

/**
 * Counts only what is due at the next deadline: a customer who still holds books due next year is
 * done for today once this year's are in. Later deadlines are still itemised below.
 */
function progress(receipt: CustomerCollectionReceipt): {
  label: string;
  color?: MantineColor;
  done: boolean;
} {
  const deadline = nextDeadline(receipt);
  if (receipt.remainingBooks.length === 0 || deadline === undefined) {
    return { label: "Alle bøker levert", color: "green", done: true };
  }
  const dueNow = (book: ReceiptBook) => formatDeadline(book.deadline) === formatDeadline(deadline);
  const delivered = receipt.collectedBooks.filter(dueNow).length;
  const remaining = receipt.remainingBooks.filter(dueNow).length;
  if (remaining === 0) {
    return { label: "Alle levert til fristen", color: "green", done: true };
  }
  return {
    label: `${delivered} av ${delivered + remaining} levert`,
    color: isOverdue(deadline) ? "red" : undefined,
    done: false,
  };
}

function ProgressBadge({ receipt }: { receipt: CustomerCollectionReceipt }) {
  const { label, color, done } = progress(receipt);
  return (
    <Badge
      variant="light"
      color={color}
      tt="none"
      leftSection={done ? <IconCheck size={12} aria-hidden /> : undefined}
      style={{ flexShrink: 0 }}
    >
      {label}
    </Badge>
  );
}

/** One customer's part of the delivery: what came in now, and what they still have. */
export default function CustomerReceiptItem({ receipt }: { receipt: CustomerCollectionReceipt }) {
  const hasRemaining = receipt.remainingBooks.length > 0;
  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
        <EntityLink to="/admin/kasse" search={showCustomerSearch(receipt.customerId)} miw={0}>
          {receipt.customerName}
        </EntityLink>
        <ProgressBadge receipt={receipt} />
      </Group>
      <SimpleGrid cols={{ base: 1, sm: hasRemaining ? 2 : 1 }} spacing="sm">
        <BookPanel
          heading="Levert nå"
          icon={IconPackageImport}
          rowIcon={IconCheck}
          color="green"
          books={receipt.collectedBooks}
        />
        {hasRemaining && (
          <BookPanel
            heading="Har fortsatt"
            icon={IconBook2}
            rowIcon={IconBook2}
            color="gray"
            books={receipt.remainingBooks}
          />
        )}
      </SimpleGrid>
    </Stack>
  );
}
