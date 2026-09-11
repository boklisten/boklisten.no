import type { BlidSearchResult, BlidStatus } from "@boklisten/backend/shared/blid_search";
import {
  ActionIcon,
  Anchor,
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
import type { ReactNode } from "react";

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
  onShowIsbn,
  onShowLabel,
}: {
  result: BlidSearchResult;
  /** Shows the pen; leave out where the book cannot be edited. */
  onEdit?: () => void;
  /** Shows a close button; leave out where the card cannot be dismissed. */
  onClear?: () => void;
  /** Makes the ISBN clickable; leave out where its barcode cannot be shown. */
  onShowIsbn?: () => void;
  /** Makes the blid clickable; leave out where the sticker cannot be shown. */
  onShowLabel?: () => void;
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
            {result.book?.isbn && (
              <>
                ISBN <Identifier onClick={onShowIsbn}>{result.book.isbn}</Identifier>
                {" · "}
              </>
            )}
            Unik ID <Identifier onClick={onShowLabel}>{result.blid}</Identifier>
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

/**
 * An identifier that reads like the dimmed text around it and only reveals itself as clickable
 * on hover and focus; plain text when there is nothing to open.
 */
function Identifier({ onClick, children }: { onClick?: () => void; children: ReactNode }) {
  if (!onClick) {
    return children;
  }
  return (
    <Anchor
      component="button"
      type="button"
      c="inherit"
      fz="inherit"
      fw="inherit"
      underline="hover"
      onClick={onClick}
    >
      {children}
    </Anchor>
  );
}
