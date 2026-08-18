import { ACQUISITION_CART_ITEM_TYPES, type CartItem } from "@boklisten/backend/shared/cart_item";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconBook, IconCashRegister, IconShoppingCart, IconX } from "@tabler/icons-react";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "react";

import InfoAlert from "@/shared/components/alerts/InfoAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import useCart from "@/shared/hooks/useCart";
import useAuth from "@/shared/hooks/useAuth";
import SegmentedControlWithLabel from "@/shared/components/SegmentedControlWithLabel";

function CheckoutButton({ to, label, blocked }: { to: string; label: string; blocked: boolean }) {
  if (blocked) {
    return (
      <Button leftSection={<IconCashRegister />} size={"md"} disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button
      component={TanStackAnchor}
      to={to}
      leftSection={<IconCashRegister />}
      size={"md"}
      bg={"green"}
      underline={"never"}
    >
      {label}
    </Button>
  );
}

export default function CartContent() {
  const cart = useCart();
  const { isEmployee, isLoggedIn } = useAuth();
  const { api } = useApiClient();
  // The conflict flags must reflect orders placed seconds ago, so bypass the global staleTime
  const { data: openOrderItems } = useQuery({
    ...api.orders.getOpenOrders.queryOptions(),
    enabled: isLoggedIn,
    staleTime: 0,
  });
  const { data: customerItems } = useQuery({
    ...api.customerItems.getCustomerItems.queryOptions(),
    enabled: isLoggedIn,
    staleTime: 0,
  });

  const ownedItemIds = new Set(
    customerItems
      ?.filter((customerItem) => ["active", "overdue"].includes(customerItem.status.type))
      .map((customerItem) => customerItem.item.id),
  );
  const orderedItemIds = new Set(openOrderItems?.map((orderItem) => orderItem.itemId));

  function getConflict(cartItem: CartItem): "owned" | "ordered" | null {
    if (!ACQUISITION_CART_ITEM_TYPES.includes(cart.getSelectedOption(cartItem).type)) return null;
    if (ownedItemIds.has(cartItem.id)) return "owned";
    if (orderedItemIds.has(cartItem.id)) return "ordered";
    return null;
  }
  const hasConflicts = cart.get().some((cartItem) => getConflict(cartItem) !== null);
  if (cart.isEmpty()) {
    return (
      <>
        <InfoAlert title={"Handlekurven er tom"}>
          Du kan finne nye bøker ved å trykke på {"'bestill bøker'"} eller administrere dine
          nåværende bøker på {"'dine bøker'"}.
        </InfoAlert>
        <Group>
          <Button component={TanStackAnchor} to={"/bestilling"} leftSection={<IconShoppingCart />}>
            Bestill bøker
          </Button>
          <Button component={TanStackAnchor} to={"/items"} leftSection={<IconBook />}>
            Dine bøker
          </Button>
        </Group>
      </>
    );
  }
  return (
    <Stack gap={"xl"}>
      <Stack>
        {cart.get().map((cartItem) => {
          const selectedOption = cart.getSelectedOption(cartItem);
          const conflict = getConflict(cartItem);
          return (
            <Card withBorder shadow={"md"} key={cartItem.id}>
              <Stack>
                <Card.Section bg={"brand"} p={"xs"}>
                  <Grid>
                    <Grid.Col span={10}>
                      <Text fw={"bolder"} c={"white"}>
                        {cartItem.title}
                      </Text>
                    </Grid.Col>
                    <Grid.Col span={2}>
                      <Stack align={"end"}>
                        <ActionIcon color={"red"} onClick={() => cart.remove(cartItem.id)}>
                          <IconX />
                        </ActionIcon>
                      </Stack>
                    </Grid.Col>
                  </Grid>
                </Card.Section>
                <Group justify={"space-between"}>
                  <Group gap={5}>
                    <Activity mode={cartItem.options.length > 1 ? "visible" : "hidden"}>
                      <SegmentedControlWithLabel
                        label={"Handling"}
                        visibleFrom={"sm"}
                        value={cartItem.selectedOptionIndex.toString()}
                        data={cartItem.options.map((option, index) => ({
                          label: cart.getOptionLabel(option),
                          value: index.toString(),
                        }))}
                        onChange={(value) => {
                          cart.add({
                            ...cartItem,
                            selectedOptionIndex: Number(value),
                          });
                        }}
                      />
                      <Select
                        hiddenFrom={"sm"}
                        value={cartItem.selectedOptionIndex.toString()}
                        data={cartItem.options.map((option, index) => ({
                          label: cart.getOptionLabel(option),
                          value: index.toString(),
                        }))}
                        onChange={(value) => {
                          cart.add({
                            ...cartItem,
                            selectedOptionIndex: Number(value),
                          });
                        }}
                      />
                    </Activity>
                    <Activity mode={cartItem.options.length === 1 ? "visible" : "hidden"}>
                      <Text>{cart.getOptionLabel(cartItem.options[0])}</Text>
                    </Activity>
                  </Group>
                  <Group>
                    <Text fw={"bold"}>{selectedOption.price} kr</Text>
                    <Activity mode={selectedOption.payLater ? "visible" : "hidden"}>
                      <Text fs={"italic"} c={"dimmed"} size={"sm"}>
                        betal senere: {selectedOption.payLater} kr
                      </Text>
                    </Activity>
                  </Group>
                </Group>
                <Activity mode={conflict ? "visible" : "hidden"}>
                  <WarningAlert
                    title={
                      conflict === "owned"
                        ? "Du har allerede denne boken"
                        : "Du har allerede bestilt denne boken"
                    }
                  >
                    <Text size={"sm"}>
                      {conflict === "owned"
                        ? "Boken er registrert på deg og ligger under «Dine bøker»."
                        : "Bestillingen din ligger under «Dine bøker»."}{" "}
                      Fjern boken fra handlekurven for å gå videre.
                    </Text>
                  </WarningAlert>
                </Activity>
              </Stack>
            </Card>
          );
        })}
      </Stack>
      <Stack align={"center"}>
        <Stack gap={5}>
          <Group gap={5}>
            <Text>Betal nå</Text>
            <Text fw={"bold"}>{cart.calculateTotal()}</Text>
            <Text>kr</Text>
          </Group>
          <Activity mode={cart.calculatePayLater() > 0 ? "visible" : "hidden"}>
            <Text fs={"italic"} c={"dimmed"} size={"sm"}>
              betal senere: {cart.calculatePayLater()} kr
            </Text>
          </Activity>
        </Stack>
        <Activity mode={hasConflicts ? "visible" : "hidden"}>
          <Box maw={400}>
            <Text size={"sm"} c={"dimmed"} ta={"center"}>
              Du kan ikke bestille flere av samme bok. Fjern bøkene du allerede har for å gå til
              kassen.
            </Text>
          </Box>
        </Activity>
        <CheckoutButton to={"/kasse"} label={"Gå til kassen"} blocked={hasConflicts} />
        <Activity mode={isEmployee ? "visible" : "hidden"}>
          <CheckoutButton
            to={"/kasse/v2"}
            label={"Gå til kassen (Kustom)"}
            blocked={hasConflicts}
          />
        </Activity>
      </Stack>
      <Activity
        mode={
          cart.get().some((cartItem) => cart.getSelectedOption(cartItem).type === "partly-payment")
            ? "visible"
            : "hidden"
        }
      >
        <Stack>
          <Title>Om delbetaling</Title>
          <Text>
            Du betaler restbeløpet på det oppgitte tidspunktet. Restbeløpet betales ved vår
            bokinnkjøpsstand på din skole på slutten av semesteret eller på nett. Mange privatister
            ønsker å selge bøkene sine på slutten av semesteret og Boklisten kjøper inn bøker fra
            privatister.
          </Text>
          <Text>
            Hvis du selger boken din til Boklisten vil vi vanligvis betale det samme som restbeløpet
            eller mer.
          </Text>
        </Stack>
      </Activity>
    </Stack>
  );
}
