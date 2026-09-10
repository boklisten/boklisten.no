import type {
  StandCartActionType,
  StandCartChoice,
  StandCartLine as CartLine,
  StandCartNote,
} from "@boklisten/backend/shared/stand_cart";
import { findOption, needsBlid } from "@boklisten/backend/shared/stand_cart";
import { ActionIcon, Card, Group, Select, Stack, Table, Text, ThemeIcon } from "@mantine/core";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";

import { showBookSearch } from "@/features/kasse/kasseParams";
import { Amount } from "@/features/stand-cart/StandCartAmounts";
import { actionLabel, formatAmount, formatDeadline } from "@/features/stand-cart/standCartLabels";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import { cartActionAppearance } from "@/shared/components/bookEventAppearance";
import EntityLink from "@/shared/components/EntityLink";
import { PeerBadge } from "@/shared/components/matches/matches-helper";

/** Wide enough for "Forleng til 01.07.2027" with its icon, and still leaves a phone room for the price. */
const ACTION_SELECT_WIDTH = 240;

/** What the drawer knows about one line, handed to both the card and the table row. */
export interface StandCartLineProps {
  line: CartLine;
  choice: StandCartChoice;
  /** Why the line cannot be submitted as it stands. */
  problem: string | null;
  /** False when nothing in the cart costs anything, so no line shows a price. */
  withPrice: boolean;
  onChoose: (choice: StandCartChoice) => void;
  onRemove: () => void;
}

/** One thing that can happen to the book, period included: "Forleng til 01.07.2027". */
interface ActionEntry {
  key: string;
  choice: StandCartChoice;
  type: StandCartActionType;
  label: string;
  available: boolean;
  reason: string | undefined;
}

function choiceKey(choice: StandCartChoice): string {
  return choice.to === undefined ? choice.type : `${choice.type}|${choice.to}`;
}

/** The line's options as entries, in the order the backend listed them, one per type and period. */
function actionEntries(line: CartLine): ActionEntry[] {
  const entries = new Map<string, ActionEntry>();
  for (const option of line.options) {
    const choice: StandCartChoice = {
      type: option.type,
      ...(option.to === undefined ? {} : { to: option.to }),
    };
    const key = choiceKey(choice);
    if (entries.has(key)) {
      continue;
    }
    const label = actionLabel(option.type, line.source.kind);
    entries.set(key, {
      key,
      choice,
      type: option.type,
      label: option.to === undefined ? label : `${label} til ${formatDeadline(option.to)}`,
      available: option.available,
      reason: option.reason,
    });
  }
  return [...entries.values()];
}

function peerNote(notes: StandCartNote[]) {
  return notes.find((note) => note.kind === "peer-match") ?? null;
}

/** The copy in hand as a link to its history, or the warning that a handout needs one. */
export function LineCopy({ line, choice }: { line: CartLine; choice: StandCartChoice }) {
  if (line.blid !== null) {
    return (
      <EntityLink
        to="/admin/kasse"
        search={showBookSearch(line.blid)}
        size="sm"
        ff="monospace"
        aria-label={`Se historikken til bok ${line.blid}`}
      >
        {line.blid}
      </EntityLink>
    );
  }
  if (!needsBlid(line.blid, choice.type)) {
    return null;
  }
  return (
    <Group gap={6} wrap="nowrap" c="orange">
      <IconAlertTriangle size={16} aria-hidden />
      <Text size="sm" c="inherit">
        Skann bokas unike ID
      </Text>
    </Group>
  );
}

/**
 * What will happen to the book, as a select even when there is only one entry, so every line
 * reads the same. The chosen action keeps its icon and colour in front of the value, every
 * entry carries its own in the list, and an action the customer cannot take says why under
 * its name.
 */
export function ActionControl({
  line,
  choice,
  onChoose,
}: {
  line: CartLine;
  choice: StandCartChoice;
  onChoose: (choice: StandCartChoice) => void;
}) {
  const entries = actionEntries(line);
  if (entries.length === 0) {
    return null;
  }
  // A choice the line no longer offers, after a branch switch or a refresh, leaves the select
  // empty rather than still naming it, so the line visibly asks to be chosen again
  const offered = entries.some((entry) => entry.key === choiceKey(choice));
  const { icon: ChosenIcon, color } = cartActionAppearance(choice.type);
  return (
    <Select
      aria-label="Handling"
      // One width for every line, so the selects stack evenly whatever the price beside them
      w={ACTION_SELECT_WIDTH}
      size="md"
      flex="0 0 auto"
      allowDeselect={false}
      value={offered ? choiceKey(choice) : null}
      placeholder="Velg handling"
      leftSection={
        offered ? (
          <ThemeIcon variant="light" color={color} size={20} radius="xl">
            <ChosenIcon size={12} aria-hidden />
          </ThemeIcon>
        ) : undefined
      }
      // Mantine drawers sit at z-index 260 here, so the dropdown must be lifted with it
      comboboxProps={{ zIndex: 300 }}
      data={entries.map((entry) => ({
        value: entry.key,
        label: entry.label,
        disabled: !entry.available,
      }))}
      renderOption={({ option }) => {
        const entry = entries.find((candidate) => candidate.key === option.value);
        if (entry === undefined) {
          return option.label;
        }
        // The same icon and colour the action has in the book's history in Boksøk
        const { icon: OptionIcon, color: optionColor } = cartActionAppearance(entry.type);
        return (
          <Group gap={8} wrap="nowrap" align="flex-start">
            <ThemeIcon variant="light" color={optionColor} size={20} radius="xl" mt={1}>
              <OptionIcon size={12} aria-hidden />
            </ThemeIcon>
            <Stack gap={0}>
              <Text size="sm">{entry.label}</Text>
              {!entry.available && entry.reason !== undefined && (
                <Text size="xs" c="dimmed">
                  {entry.reason}
                </Text>
              )}
            </Stack>
          </Group>
        );
      }}
      onChange={(value) => {
        const entry = entries.find((candidate) => candidate.key === value);
        if (entry) {
          onChoose(entry.choice);
        }
      }}
    />
  );
}

/**
 * Why the line cannot be submitted as it stands. The missing-copy problem is left out, since the
 * copy slot already says "scan the book"; a monitored choice is summed up under the lines.
 */
function LineProblem({
  line,
  choice,
  problem,
}: {
  line: CartLine;
  choice: StandCartChoice;
  problem: string | null;
}) {
  if (problem === null || line.options.length === 0 || needsBlid(line.blid, choice.type)) {
    return null;
  }
  return (
    <Text size="sm" c="orange">
      {problem}
    </Text>
  );
}

export function LinePrice({ line, choice }: { line: CartLine; choice: StandCartChoice }) {
  const option = findOption(line, choice);
  if (option === null) {
    return null;
  }
  return (
    <Stack gap={0} align="flex-end" flex="0 0 auto" style={{ whiteSpace: "nowrap" }}>
      <Amount amount={option.price} />
      {option.payLater !== undefined && option.payLater > 0 && (
        <Text size="xs" c="dimmed">
          betal senere {formatAmount(option.payLater)}
        </Text>
      )}
    </Stack>
  );
}

export function RemoveLineButton({ line, onRemove }: { line: CartLine; onRemove: () => void }) {
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      aria-label={`Fjern «${line.title}» fra handlekurven`}
      onClick={onRemove}
    >
      <IconX size={18} aria-hidden />
    </ActionIcon>
  );
}

/** The name of the book, with the one note the checkout will stop and ask about. */
export function LineTitle({ line }: { line: CartLine }) {
  const peer = peerNote(line.notes);
  return (
    <Stack gap={4} align="flex-start" miw={0}>
      <Text fw={600} lh={1.3}>
        {line.title}
      </Text>
      {peer !== null && <PeerBadge>Skal mottas fra {peer.deliverFromName}</PeerBadge>}
    </Stack>
  );
}

/**
 * One book in the cart on a phone, as a card: what it is and which copy, then what will happen
 * to it and what it costs on one row. The action control is the line's one strong element.
 */
export default function StandCartLine({
  line,
  choice,
  problem,
  withPrice,
  onChoose,
  onRemove,
}: StandCartLineProps) {
  return (
    <Card withBorder radius="md" padding="sm">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Stack gap={4} miw={0}>
            <LineTitle line={line} />
            {/* The copy in hand belongs with the title: a sticker and a book are one thing */}
            <LineCopy line={line} choice={choice} />
          </Stack>
          <RemoveLineButton line={line} onRemove={onRemove} />
        </Group>

        {problem !== null && line.options.length === 0 && <WarningAlert>{problem}</WarningAlert>}

        <LineProblem line={line} choice={choice} problem={problem} />

        {/* What happens to the book and what it costs, read together on one row */}
        <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
          <ActionControl line={line} choice={choice} onChoose={onChoose} />
          {withPrice && <LinePrice line={line} choice={choice} />}
        </Group>
      </Stack>
    </Card>
  );
}

/**
 * The same line as a table row on wider screens: one book per row so a full cart is read at a
 * glance. The copy column is only there when some line has a copy; a problem with no action to
 * choose from replaces the action.
 */
export function StandCartLineRow({
  line,
  choice,
  problem,
  withCopy,
  withPrice,
  onChoose,
  onRemove,
}: StandCartLineProps & { withCopy: boolean }) {
  return (
    <Table.Tr>
      <Table.Td>
        <LineTitle line={line} />
      </Table.Td>
      {withCopy && (
        <Table.Td>
          <LineCopy line={line} choice={choice} />
        </Table.Td>
      )}
      <Table.Td>
        <Stack gap="xs" align="flex-start">
          <LineProblem line={line} choice={choice} problem={problem} />
          {problem !== null && line.options.length === 0 ? (
            <Text size="sm" c="orange">
              {problem}
            </Text>
          ) : (
            <ActionControl line={line} choice={choice} onChoose={onChoose} />
          )}
        </Stack>
      </Table.Td>
      {withPrice && (
        // Amounts keep their right edges in line, the way a sum is written out by hand
        <Table.Td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
          <LinePrice line={line} choice={choice} />
        </Table.Td>
      )}
      <Table.Td style={{ textAlign: "right" }}>
        <RemoveLineButton line={line} onRemove={onRemove} />
      </Table.Td>
    </Table.Tr>
  );
}
