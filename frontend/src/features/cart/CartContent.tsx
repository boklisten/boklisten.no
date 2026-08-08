import { ActionIcon, Button, Card, Grid, Group, Select, Stack, Text, Title } from "@mantine/core";
import { IconBook, IconCashRegister, IconShoppingCart, IconX } from "@tabler/icons-react";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { Activity } from "react";

import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useCart from "@/shared/hooks/useCart";
import useAuth from "@/shared/hooks/useAuth";
import SegmentedControlWithLabel from "@/shared/components/SegmentedControlWithLabel";

export default function CartContent() {
  const cart = useCart();
  const { isEmployee } = useAuth();
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
        <Button
          component={TanStackAnchor}
          to={"/kasse"}
          leftSection={<IconCashRegister />}
          size={"md"}
          bg={"green"}
          underline={"never"}
        >
          Gå til kassen
        </Button>
        <Activity mode={isEmployee ? "visible" : "hidden"}>
          <Button
            component={TanStackAnchor}
            to={"/kasse/v2"}
            leftSection={<IconCashRegister />}
            size={"md"}
            bg={"green"}
            underline={"never"}
          >
            Gå til kassen (Kustom)
          </Button>
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
