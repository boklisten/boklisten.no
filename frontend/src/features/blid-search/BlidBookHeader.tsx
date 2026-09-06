import type { BlidSearchResult, BlidStatus } from "@boklisten/backend/shared/blid_search";
import {
  ActionIcon,
  Badge,
  CloseButton,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconBook2, IconPencil } from "@tabler/icons-react";

// A buyback leaves the book at the stand, so it shows as "Ikke utdelt"; only a buyout means
// the customer keeps the book.
const STATUS_BADGE = {
  "handed-out": { label: "Utdelt", color: "green" },
  "bought-out": { label: "Kjøpt ut", color: "teal" },
  "not-handed-out": { label: "Ikke utdelt", color: "gray" },
} as const satisfies Record<BlidStatus, { label: string; color: string }>;

/** Card header for a searched book: what it is, its identifiers, and where it stands. */
export default function BlidBookHeader({
  result,
  onEdit,
  onClear,
}: {
  result: BlidSearchResult;
  /** Shows the pen; leave out where the book cannot be edited. */
  onEdit?: () => void;
  /** Shows a close button; leave out where the card cannot be dismissed. */
  onClear?: () => void;
}) {
  const { label, color } = STATUS_BADGE[result.status];
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
      <Group gap="sm" align="center" wrap="nowrap" miw={0}>
        <ThemeIcon variant="light" size="xl" radius="xl">
          <IconBook2 aria-hidden />
        </ThemeIcon>
        <Stack gap={4} miw={0}>
          <Title order={2} size="h4" lh={1.2}>
            {result.book?.title ?? "Ukjent tittel"}
          </Title>
          <Text size="sm" c="dimmed">
            {result.book?.isbn ? `ISBN ${result.book.isbn} · ` : ""}Unik ID {result.blid}
          </Text>
        </Stack>
      </Group>
      <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
        <Badge variant="light" color={color}>
          {label}
        </Badge>
        {onEdit && (
          <Tooltip label="Rediger bok">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label="Rediger bok"
              onClick={onEdit}
            >
              <IconPencil size={20} aria-hidden />
            </ActionIcon>
          </Tooltip>
        )}
        {onClear && <CloseButton aria-label="Lukk boksøket" onClick={onClear} />}
      </Group>
    </Group>
  );
}
