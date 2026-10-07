import { Group, Stack, ThemeIcon, Title } from "@mantine/core";
import type { Icon } from "@tabler/icons-react";
import type { ReactNode } from "react";

/**
 * One part of a customer's book list (ordered or held) with a heading that says
 * which, so the groups under it can never be read as belonging to another part.
 */
export default function BookListSection({
  title,
  icon: SectionIcon,
  children,
}: {
  title: string;
  icon: Icon;
  children: ReactNode;
}) {
  return (
    <Stack gap="xs" component="section" aria-label={title}>
      <Group gap="xs">
        <ThemeIcon variant="light" color="gray" size={28} radius="xl">
          <SectionIcon size={16} aria-hidden />
        </ThemeIcon>
        <Title order={3} size="h4">
          {title}
        </Title>
      </Group>
      {children}
    </Stack>
  );
}
