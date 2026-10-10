import { Box, Divider, Stack, Text } from "@mantine/core";

import { TotalRow } from "@/features/stand-cart/StandCartAmounts";
import StandCartLine from "@/features/stand-cart/StandCartLine";
import type { StandCart } from "@/features/stand-cart/useStandCart";

/**
 * The books in the cart as the shared cart lines, the same at every width and the same as the
 * public cart, with the grand total under them. The total's right edge meets the lines' prices.
 */
export default function StandCartLines({ cart }: { cart: StandCart }) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500} id="stand-cart-lines">
        Bøker
      </Text>
      <Stack
        component="ul"
        gap="xs"
        m={0}
        p={0}
        style={{ listStyle: "none" }}
        aria-labelledby="stand-cart-lines"
      >
        {cart.lines.map(({ line, choice, problem }) => (
          <StandCartLine
            key={line.key}
            line={line}
            choice={choice}
            problem={problem}
            withPrice={cart.hasPrice}
            onChoose={(next) => cart.choose(line.key, next)}
            onRemove={() => cart.remove(line.key)}
          />
        ))}
      </Stack>
      {cart.hasPrice && (
        <>
          <Divider />
          {/* The lines' padding (0.875rem) plus their border */}
          <Box px="calc(0.875rem + 1px)">
            <TotalRow cart={cart} />
          </Box>
        </>
      )}
    </Stack>
  );
}
