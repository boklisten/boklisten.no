import type {
  StandCartChoice,
  StandCartLine as CartLine,
  StandCartNote,
} from "@boklisten/backend/shared/stand_cart";
import { findOption, needsBlid } from "@boklisten/backend/shared/stand_cart";
import { Group, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

import CartLineCard from "@/features/cart-line/CartLineCard";
import type { CartLineChoice } from "@/features/cart-line/CartLineCard";
import CustomerLink from "@/features/kasse/CustomerLink";
import { showBlid } from "@/features/kasse/kasseParams";
import { describeChoice } from "@/features/stand-cart/standCartLabels";
import { cartActionAppearance } from "@/shared/components/bookEventAppearance";
import EntityLink from "@/shared/components/EntityLink";
import { PeerBadge } from "@/shared/components/matches/matches-helper";

/** What the drawer knows about one line. */
interface StandCartLineProps {
  line: CartLine;
  choice: StandCartChoice;
  /** Why the line cannot be submitted as it stands. */
  problem: string | null;
  /** False when nothing in the cart costs anything, so no line shows a price. */
  withPrice: boolean;
  onChoose: (choice: StandCartChoice) => void;
  onRemove: () => void;
}

/** One thing that can happen to the book, period included: "Forleng til 1. juli 2027". */
interface ActionEntry extends CartLineChoice {
  choice: StandCartChoice;
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
    entries.set(key, {
      key,
      choice,
      label: describeChoice(choice, line.source.kind),
      blockedReason: option.available ? undefined : (option.reason ?? "Ikke tilgjengelig nå"),
      // The same icon and colour the action has in the book's history in Boksøk
      appearance: cartActionAppearance(option.type),
    });
  }
  return [...entries.values()];
}

function peerNote(notes: StandCartNote[]) {
  return notes.find((note) => note.kind === "peer-match") ?? null;
}

/** The copy in hand as a link to its history, or the warning that a handout needs one. */
function LineCopy({ line, choice }: { line: CartLine; choice: StandCartChoice }) {
  if (line.blid !== null) {
    return (
      <EntityLink
        to="/admin/kasse"
        search={showBlid(line.blid)}
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
 * One book in Kasse's cart: the shared cart line, with the copy in hand (or the warning that a
 * handout needs one) and the peer handout under the title. The missing-copy problem is left out
 * of the notice, since the copy slot already says "scan the book"; a monitored choice is summed
 * up under the lines.
 */
export default function StandCartLine({
  line,
  choice,
  problem,
  withPrice,
  onChoose,
  onRemove,
}: StandCartLineProps) {
  const entries = actionEntries(line);
  // A choice the line no longer offers, after a branch switch or a refresh, selects nothing, so
  // the line visibly asks to be chosen again
  const offered = entries.some((entry) => entry.key === choiceKey(choice));
  const option = findOption(line, choice);
  const peer = peerNote(line.notes);
  const notice =
    problem !== null && (line.options.length === 0 || !needsBlid(line.blid, choice.type))
      ? problem
      : null;
  return (
    <CartLineCard
      title={line.title}
      isbn={line.isbn}
      details={
        (line.blid !== null || needsBlid(line.blid, choice.type) || peer !== null) && (
          <>
            {/* The copy in hand belongs with the title: a sticker and a book are one thing */}
            <LineCopy line={line} choice={choice} />
            {peer !== null && (
              <PeerBadge>
                Mottas fra{" "}
                <CustomerLink userId={peer.deliverFromId} inherit>
                  {peer.deliverFromName}
                </CustomerLink>
              </PeerBadge>
            )}
          </>
        )
      }
      choices={entries}
      selectedKey={offered ? choiceKey(choice) : null}
      onSelect={(key) => {
        const entry = entries.find((candidate) => candidate.key === key);
        if (entry) {
          onChoose(entry.choice);
        }
      }}
      price={withPrice && option ? { now: option.price, later: option.payLater } : null}
      notice={notice}
      warn={notice !== null}
      onRemove={onRemove}
    />
  );
}
