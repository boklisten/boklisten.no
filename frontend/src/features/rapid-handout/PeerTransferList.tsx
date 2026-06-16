import { Badge, Card, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconArrowRight, IconCircleCheck, IconLock } from "@tabler/icons-react";

/** A book the customer exchanges with another student (received from / delivered to a peer). */
export interface PeerBook {
  /** Item id. */
  id: string;
  title: string;
  /** Whether the transfer has already happened. */
  fulfilled: boolean;
  /** Name of the other student in the match. */
  personName: string;
  /** Whether the match is locked, making stand handout impossible. */
  locked: boolean;
}

/**
 * A calm, informational list of books that are exchanged with other students rather than handed
 * out at the stand. Only the locked state gets a red/warning treatment, signalling the book cannot
 * be handed out at the stand until the match is unlocked.
 */
export default function PeerTransferList({
  title,
  direction,
  books,
}: {
  title: string;
  direction: "receive" | "give";
  books: PeerBook[];
}) {
  const verb = direction === "receive" ? "Eleven får denne fra" : "Eleven gir denne til";
  const lockedLabel =
    direction === "receive" ? "Låst – kan ikke deles ut på stand" : "Låst til overlevering";

  return (
    <Stack gap={"xs"}>
      <Title order={2}>{title}</Title>
      <Stack gap={"sm"}>
        {books.map((book) => (
          <Card
            key={`${book.id}-${book.personName}`}
            withBorder
            radius={"md"}
            padding={"sm"}
            style={book.locked ? { borderColor: "var(--mantine-color-red-5)" } : undefined}
          >
            <Stack gap={"xs"}>
              <Group justify={"space-between"} wrap={"nowrap"} align={"flex-start"}>
                <Group gap={"sm"} wrap={"nowrap"} align={"center"} miw={0}>
                  <ThemeIcon
                    color={book.locked ? "red" : "gray"}
                    variant={"light"}
                    size={"lg"}
                    radius={"xl"}
                  >
                    {book.locked ? <IconLock size={22} /> : <IconArrowRight size={22} />}
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
                {verb}{" "}
                <Text span fw={600} c={book.locked ? "red" : undefined}>
                  {book.personName}
                </Text>
              </Text>

              {book.locked && (
                <Badge color={"red"} variant={"light"} leftSection={<IconLock size={12} />}>
                  {lockedLabel}
                </Badge>
              )}
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}
