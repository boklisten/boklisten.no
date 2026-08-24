import { Card, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconArrowRight, IconCircleCheck } from "@tabler/icons-react";

import type { PeerBook } from "@/features/rapid-handout/handoutBooks";

/**
 * A list of books the customer gives to other students rather than delivering
 * at the stand.
 */
export default function PeerTransferList({ title, books }: { title: string; books: PeerBook[] }) {
  return (
    <Stack gap={"xs"}>
      <Title order={2}>{title}</Title>
      <Stack gap={"sm"}>
        {books.map((book) => (
          <Card key={`${book.id}-${book.personName}`} withBorder radius={"md"} padding={"sm"}>
            <Stack gap={"xs"}>
              <Group justify={"space-between"} wrap={"nowrap"} align={"flex-start"}>
                <Group gap={"sm"} wrap={"nowrap"} align={"center"} miw={0}>
                  <ThemeIcon color={"gray"} variant={"light"} size={"lg"} radius={"xl"}>
                    <IconArrowRight size={22} />
                  </ThemeIcon>
                  <Text fw={600}>{book.title}</Text>
                </Group>
                {book.fulfilled && (
                  <ThemeIcon color={"green"} variant={"light"} radius={"xl"} size={"md"}>
                    <IconCircleCheck size={18} />
                  </ThemeIcon>
                )}
              </Group>

              <Text size={"sm"} c={"dimmed"}>
                Eleven gir denne til{" "}
                <Text span fw={600}>
                  {book.personName}
                </Text>
              </Text>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
