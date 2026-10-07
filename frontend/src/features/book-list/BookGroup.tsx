import { Badge, Group, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

import classes from "@/features/book-list/BookList.module.css";
import { groupIsOverdue, periodLabel } from "@/features/book-list/bookGroups";
import type { BookGroupData } from "@/features/book-list/bookGroups";

/**
 * Books that share a deadline, under one header that says so and names their branch. An expired
 * deadline is shown here once rather than on every book, since the whole group is due on the same
 * day.
 */
export default function BookGroup({
  group,
  held = true,
  children,
}: {
  group: BookGroupData<unknown>;
  /** Whether the books are still with the customer, so an expired deadline matters. */
  held?: boolean;
  children: ReactNode;
}) {
  const overdue = groupIsOverdue(group, held);
  const label = periodLabel(group);
  const count = group.books.length;
  return (
    <section className={classes.group} aria-label={label}>
      <div className={classes.header}>
        <Stack gap={0} miw={0}>
          <Group gap="xs">
            <Text fw={700}>{label}</Text>
            {overdue && (
              <Badge color="red" variant="filled" tt="none">
                Fristen har gått ut
              </Badge>
            )}
          </Group>
          {group.branchNames.length > 0 && (
            <Text size="sm" c="dimmed">
              {group.branchNames.join(", ")}
            </Text>
          )}
        </Stack>
        <Text size="sm" c="dimmed">
          {count} {count === 1 ? "bok" : "bøker"}
        </Text>
      </div>
      {children}
    </section>
  );
}
