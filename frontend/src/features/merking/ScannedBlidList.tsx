import { CloseButton, Group, Loader, Paper, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";

import RegistrationReceipt from "@/features/merking/RegistrationReceipt";
import StepLabel from "@/features/merking/StepLabel";
import { blidCountLabel, rowState } from "@/features/merking/registrationRows";
import type {
  BatchReceipt,
  RowState,
  ScannedBlidRow,
  SelectedBook,
} from "@/features/merking/registrationRows";
import { showBlid } from "@/features/kasse/kasseParams";
import EntityLink from "@/shared/components/EntityLink";
import ScanPrompt from "@/shared/components/scanner/ScanPrompt";

function RowStatus({ state, row }: { state: RowState; row: ScannedBlidRow }) {
  const linkedTitle = row.check.status === "checked" ? row.check.linkedTo?.title : undefined;
  switch (state) {
    case "checking": {
      return <Loader size="xs" aria-label="Sjekker" />;
    }
    case "free": {
      return (
        <Group gap={4} wrap="nowrap" c="green">
          <IconCheck size={16} aria-hidden style={{ flexShrink: 0 }} />
          <Text size="sm">Ledig</Text>
        </Group>
      );
    }
    case "linked": {
      return (
        <Text size="sm" c="dimmed">
          Koblet til «{linkedTitle}»
        </Text>
      );
    }
    case "linked-here": {
      return (
        <Text size="sm" c="dimmed">
          Allerede koblet til denne boka
        </Text>
      );
    }
    case "linked-elsewhere": {
      return (
        <Group gap={4} wrap="nowrap" c="red" fw={500}>
          <IconAlertTriangle size={16} aria-hidden style={{ flexShrink: 0 }} />
          <Text size="sm">Koblet til «{linkedTitle}»</Text>
        </Group>
      );
    }
    default: {
      return (
        <Group gap={4} wrap="nowrap" c="red" fw={500}>
          <IconAlertTriangle size={16} aria-hidden style={{ flexShrink: 0 }} />
          <Text size="sm">Kunne ikke sjekkes</Text>
        </Group>
      );
    }
  }
}

/** One sticker: its blid (a link into Boksøk), what the database says about it, and a remove x. */
function BlidRow({
  row,
  state,
  onRemove,
}: {
  row: ScannedBlidRow;
  state: RowState;
  onRemove: () => void;
}) {
  const blocking = state === "linked-elsewhere" || state === "failed";
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      gap="sm"
      py={6}
      style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
    >
      <Stack gap={2} miw={0}>
        <EntityLink
          to="/admin/kasse"
          search={showBlid(row.blid)}
          ff="monospace"
          fw={blocking ? 600 : 500}
          c={blocking ? "red" : "inherit"}
          aria-label={`Se historikken til bok ${row.blid}`}
        >
          {row.blid}
        </EntityLink>
        <RowStatus state={state} row={row} />
      </Stack>
      <CloseButton
        c={blocking ? "red" : undefined}
        style={{ flexShrink: 0 }}
        aria-label={`Fjern ${row.blid} fra listen`}
        onClick={onRemove}
      />
    </Group>
  );
}

/** The stickers scanned for the batch, newest first, with what the database says about each. */
export default function ScannedBlidList({
  rows,
  book,
  receipt,
  onRemove,
  onDismissReceipt,
}: {
  rows: ScannedBlidRow[];
  book: SelectedBook | null;
  receipt: BatchReceipt | null;
  onRemove: (blid: string) => void;
  onDismissReceipt: () => void;
}) {
  return (
    <Paper withBorder radius="md" p="md" h="100%">
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          <StepLabel step={2} done={rows.length > 0}>
            Unike IDer
          </StepLabel>
          {rows.length > 0 && (
            <Text size="sm" c="dimmed">
              {blidCountLabel(rows.length)}
            </Text>
          )}
        </Group>

        {receipt !== null && <RegistrationReceipt receipt={receipt} onDismiss={onDismissReceipt} />}

        {rows.length === 0 && receipt === null && (
          <ScanPrompt type="blid">Skann unik ID på hver bok</ScanPrompt>
        )}

        {rows.length > 0 && (
          <Stack gap={0}>
            {rows.map((row) => (
              <BlidRow
                key={row.blid}
                row={row}
                state={rowState(row, book)}
                onRemove={() => onRemove(row.blid)}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
