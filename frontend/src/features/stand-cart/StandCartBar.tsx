import {
  Affix,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Transition,
} from "@mantine/core";
import { IconBasket } from "@tabler/icons-react";

import { formatAmount } from "@/features/stand-cart/standCartLabels";
import type { StandCart } from "@/features/stand-cart/useStandCart";

// Above the scanner modal (Mantine's 200), below the scanner's own dialogs (300 and up), so the
// cart stays in view while the employee scans through the pile.
const BAR_Z_INDEX = 250;

function countLabel(count: number): string {
  return count === 1 ? "1 bok i handlekurven" : `${count} bøker i handlekurven`;
}

function problemsLabel(count: number): string {
  return count === 1 ? "1 bok trenger et valg" : `${count} bøker trenger et valg`;
}

/**
 * The line under the count: what still needs a choice, else the sum the same way the cart's
 * Totalt row writes it (signed, red when negative), else nothing — a free handout has no price.
 */
function summaryLine(cart: StandCart): { text: string; color: string } | null {
  const problems = cart.problems.length;
  if (problems > 0) {
    return { text: problemsLabel(problems), color: "orange" };
  }
  if (!cart.hasPrice) {
    return null;
  }
  return { text: `Totalt: ${formatAmount(cart.total)}`, color: cart.total < 0 ? "red" : "dimmed" };
}

/**
 * Floats at the bottom of the screen while the cart has lines: what is in it, what it costs,
 * and the one way in. Stays in reach however far the employee scrolls through the book lists.
 * Composed from Affix rather than Mantine's ActionBar: that one stretches an invisible strip
 * across the screen that swallows clicks on the rows beside the bar.
 */
export default function StandCartBar({ cart, onOpen }: { cart: StandCart; onOpen: () => void }) {
  const summary = summaryLine(cart);
  return (
    <Affix
      position={{ bottom: 30, left: 0, right: 0 }}
      zIndex={BAR_Z_INDEX}
      style={{ pointerEvents: "none" }}
    >
      <Transition mounted={!cart.isEmpty} transition="pop" duration={200}>
        {(transitionStyle) => (
          <Paper
            withBorder
            shadow="lg"
            radius="md"
            py="xs"
            px="sm"
            role="group"
            aria-label="Handlekurv"
            style={{
              ...transitionStyle,
              pointerEvents: "auto",
              width: "fit-content",
              marginInline: "auto",
              display: "flex",
              alignItems: "center",
              gap: "var(--mantine-spacing-sm)",
            }}
          >
            <Group gap="sm" wrap="nowrap" miw={0}>
              <ThemeIcon variant="light" size="lg" radius="xl">
                <IconBasket size={20} aria-hidden />
              </ThemeIcon>
              <Stack gap={0} miw={0}>
                <Text fw={600} lh={1.2} size="sm">
                  {countLabel(cart.cart.lines.length)}
                </Text>
                {summary && (
                  <Text size="sm" c={summary.color} lh={1.3}>
                    {summary.text}
                  </Text>
                )}
              </Stack>
            </Group>
            <Divider orientation="vertical" />
            {/* The full label does not fit beside the summary on a phone */}
            <Button onClick={onOpen} flex="0 0 auto" visibleFrom="sm">
              Åpne handlekurv
            </Button>
            <Button onClick={onOpen} flex="0 0 auto" hiddenFrom="sm">
              Åpne
            </Button>
          </Paper>
        )}
      </Transition>
    </Affix>
  );
}
