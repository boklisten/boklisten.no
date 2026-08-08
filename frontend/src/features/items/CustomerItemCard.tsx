import type { CustomerItemStatus } from "@boklisten/backend/shared/customer-item/actionable_customer_item";
import { Badge, Button, Card, Divider, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import {
  IconBasketCheck,
  IconBook2,
  IconCalendarEvent,
  IconClockPlus,
  IconHourglassHigh,
  IconQrcode,
  IconSchool,
  IconShoppingCart,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import { Activity, type ReactNode } from "react";

import useCart from "@/shared/hooks/useCart";
import { norwegianTime } from "@/shared/utils/dayjs";
import { Route } from "@tuyau/core/types";

function InfoEntry({
  startIcon,
  label,
  text,
}: {
  startIcon: ReactNode;
  label: string;
  text: string;
}) {
  return (
    <Group gap={"xs"}>
      {startIcon}
      <Tooltip label={label}>
        <Text>{text}</Text>
      </Tooltip>
    </Group>
  );
}

function StatusChip({ status }: { status: CustomerItemStatus }) {
  return (
    <Badge
      color={
        ["returned", "buyout"].includes(status.type)
          ? "gray"
          : status.type === "overdue"
            ? "red"
            : "green"
      }
    >
      {status.text}
    </Badge>
  );
}

export default function CustomerItemCard({
  actionableCustomerItem,
}: {
  actionableCustomerItem: Route.Response<"customer_items.get_customer_items">[number];
}) {
  const cart = useCart();
  const cartItem = cart.get().find((cartItem) => cartItem.id === actionableCustomerItem.item.id);

  return (
    <Card shadow={"md"} withBorder>
      <Group gap={"xs"} mb={"md"}>
        <Title order={3}>{actionableCustomerItem.item.title}</Title>
        <StatusChip status={actionableCustomerItem.status} />
      </Group>
      <Stack>
        <InfoEntry
          startIcon={<IconQrcode />}
          label={"Unik ID"}
          text={actionableCustomerItem.blid ?? ""}
        />
        <InfoEntry
          label={"ISBN"}
          startIcon={<IconBook2 />}
          text={actionableCustomerItem.item.isbn}
        />
        <InfoEntry
          label={"Ansvarlig filial"}
          startIcon={<IconSchool />}
          text={actionableCustomerItem.branch.name}
        />
        <InfoEntry
          label={"Utdelingstidspunkt"}
          startIcon={<IconHourglassHigh />}
          text={norwegianTime(actionableCustomerItem.handoutAt).format("DD/MM/YYYY")}
        />
        <Divider />
        <Group>
          <IconCalendarEvent />
          <Text>Frist: </Text>
          <Text fw={"bold"}>
            {norwegianTime(actionableCustomerItem.deadline).format("DD/MM/YYYY")}
          </Text>
        </Group>
        <Activity
          mode={
            ["active", "overdue"].includes(actionableCustomerItem.status.type)
              ? "visible"
              : "hidden"
          }
        >
          <Group>
            {actionableCustomerItem.actions.map((action, index) => {
              const actionCartItem = cart
                .get()
                .find(
                  (cartItem) =>
                    cartItem.id === actionableCustomerItem.item.id &&
                    cart.getSelectedOption(cartItem).type === action.type &&
                    ("to" in action
                      ? dayjs(cart.getSelectedOption(cartItem).to).isSame(action.to)
                      : true),
                );
              return (
                <Tooltip key={action.type} label={action.tooltip} disabled={!action.tooltip}>
                  <Button
                    leftSection={
                      actionCartItem ? (
                        <IconBasketCheck />
                      ) : action.type === "extend" ? (
                        <IconClockPlus />
                      ) : (
                        <IconShoppingCart />
                      )
                    }
                    bg={actionCartItem ? "green" : ""}
                    disabled={!action.available}
                    onClick={() => {
                      if (actionCartItem) {
                        cart.remove(actionableCustomerItem.item.id);
                        return;
                      }
                      const availableActions = actionableCustomerItem.actions.filter(
                        (action) => action.available,
                      );
                      cart.add({
                        id: actionableCustomerItem.item.id,
                        title: actionableCustomerItem.item.title,
                        branchId: actionableCustomerItem.branch.id,
                        options: availableActions.map((a) => ({
                          type: a.type,
                          price: a.price,
                          ...("to" in a ? { to: a.to } : {}),
                        })),
                        selectedOptionIndex: availableActions.length > 1 ? index : 0,
                      });
                    }}
                  >
                    {action.label}
                  </Button>
                </Tooltip>
              );
            })}
          </Group>
        </Activity>
        {cartItem && (
          <Group gap={5}>
            <Text>Pris:</Text>
            <Text fw={"bold"}>{cart.getSelectedOption(cartItem).price} kr</Text>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
