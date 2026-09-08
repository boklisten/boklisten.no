import { needsBlid } from "@boklisten/backend/shared/stand_cart";
import { Box, Divider, Stack, Table, Text } from "@mantine/core";

import { TotalAmount, TotalRow } from "@/features/stand-cart/StandCartAmounts";
import StandCartLine, { StandCartLineRow } from "@/features/stand-cart/StandCartLine";
import type { StandCart } from "@/features/stand-cart/useStandCart";

/**
 * The books in the cart with their grand total: a table on wider screens, where a whole cart
 * fits in a few rows and the total is its footer, and cards on a phone, where the action
 * control needs the full width. The copy column appears only once a line has a copy, or needs
 * one to be scanned. The amounts share one right edge, the way a sum is written out by hand.
 */
export default function StandCartLines({ cart }: { cart: StandCart }) {
  const withCopy = cart.lines.some(
    ({ line, choice }) => line.blid !== null || needsBlid(line.blid, choice.type),
  );
  const withPrice = cart.hasPrice;
  return (
    <>
      <Stack gap="xs" hiddenFrom="sm">
        {/* The cards have no column headers, so the list is named the way the branch field is */}
        <Text size="sm" fw={500}>
          Bøker
        </Text>
        {cart.lines.map(({ line, choice, problem }) => (
          <StandCartLine
            key={line.key}
            line={line}
            choice={choice}
            problem={problem}
            withPrice={withPrice}
            onChoose={(next) => cart.choose(line.key, next)}
            onRemove={() => cart.remove(line.key)}
          />
        ))}
        {withPrice && (
          <>
            <Divider />
            {/* The cards' inner padding plus their border, so the total's right edge meets the card prices */}
            <Box px="calc(var(--mantine-spacing-sm) + 1px)">
              <TotalRow cart={cart} />
            </Box>
          </>
        )}
      </Stack>
      <Box visibleFrom="sm">
        <Table verticalSpacing="sm" horizontalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tittel</Table.Th>
              {withCopy && <Table.Th>Unik ID</Table.Th>}
              <Table.Th>Handling</Table.Th>
              {withPrice && <Table.Th>Pris</Table.Th>}
              <Table.Th aria-label="Fjern" />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {cart.lines.map(({ line, choice, problem }) => (
              <StandCartLineRow
                key={line.key}
                line={line}
                choice={choice}
                problem={problem}
                withCopy={withCopy}
                withPrice={withPrice}
                onChoose={(next) => cart.choose(line.key, next)}
                onRemove={() => cart.remove(line.key)}
              />
            ))}
          </Table.Tbody>
          {withPrice && (
            <Table.Tfoot>
              {/* The sum line: drawn above the total the way the payment step draws its divider */}
              <Table.Tr style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
                <Table.Td>
                  <Text fw={700}>Totalt</Text>
                </Table.Td>
                {withCopy && <Table.Td />}
                <Table.Td />
                <Table.Td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  <TotalAmount cart={cart} />
                </Table.Td>
                <Table.Td />
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </Box>
    </>
  );
}
