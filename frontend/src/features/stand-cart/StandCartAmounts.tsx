import { Group, Paper, Stack, Text } from "@mantine/core";

import { formatAmount } from "@/features/stand-cart/standCartLabels";
import type { StandCart } from "@/features/stand-cart/useStandCart";

/** Digits of equal width, so amounts stacked in a column line up like a handwritten sum. */
export const TABULAR_NUMBERS = { fontVariantNumeric: "tabular-nums" } as const;

/** One amount the way every amount in the cart is written: bold, red with a minus for refunds. */
export function Amount({ amount }: { amount: number }) {
  return (
    <Text fw={700} lh={1.2} c={amount < 0 ? "red" : undefined} style={TABULAR_NUMBERS}>
      {formatAmount(amount)}
    </Text>
  );
}

/**
 * The grand total: the number one size up, the "kr" at the lines' own size, so the unit sits
 * level with the amounts above it however big the number is.
 */
export function TotalAmount({ cart }: { cart: StandCart }) {
  const color = cart.total < 0 ? "red" : undefined;
  return (
    <Stack gap={0} align="flex-end">
      <Text fw={700} lh={1.2} c={color} style={TABULAR_NUMBERS}>
        <Text span fz="xl" fw={700} c={color} style={TABULAR_NUMBERS}>
          {formatAmount(cart.total).replace(/ kr$/, "")}
        </Text>{" "}
        kr
      </Text>
      {cart.payLater > 0 && (
        <Text size="xs" c="dimmed">
          betales senere {formatAmount(cart.payLater)}
        </Text>
      )}
    </Stack>
  );
}

/** The "Totalt" row: label left, total right, the same wherever a cart is summed up. */
export function TotalRow({ cart }: { cart: StandCart }) {
  return (
    <Group justify="space-between" align="baseline" wrap="nowrap">
      <Text fw={700}>Totalt</Text>
      <TotalAmount cart={cart} />
    </Group>
  );
}

/**
 * The total as the one thing on the payment step's mind: a large signed number on its own
 * tinted panel, set apart from the ways of taking the money below it.
 */
export function TotalHero({ cart }: { cart: StandCart }) {
  const color = cart.total < 0 ? "red" : undefined;
  return (
    <Paper radius="md" py="lg" px="md" bg="var(--mantine-color-default-hover)">
      <Stack gap={4} align="center">
        <Text size="sm" c="dimmed">
          Totalt
        </Text>
        <Text fw={700} lh={1} c={color} style={TABULAR_NUMBERS}>
          <Text span fz={44} fw={700} lh={1} c={color} style={TABULAR_NUMBERS}>
            {formatAmount(cart.total).replace(/ kr$/, "")}
          </Text>{" "}
          <Text span fz="xl" fw={700} c={color}>
            kr
          </Text>
        </Text>
        {cart.payLater > 0 && (
          <Text size="sm" c="dimmed">
            betales senere {formatAmount(cart.payLater)}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}
