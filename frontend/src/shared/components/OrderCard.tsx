import type { OrderItem } from "@boklisten/backend/shared/order/order-item/order-item";
import { Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconCheck, IconExclamationMark, IconQrcode, IconSignature } from "@tabler/icons-react";
import { Activity } from "react";

import WarningAlert from "@/shared/components/alerts/WarningAlert";
import OrderItemTypeIcon from "@/shared/components/OrderItemTypeIcon";
import { norwegianTime } from "@/shared/utils/dayjs";

export default function OrderCard({
  id,
  creationTime,
  pendingSignature,
  orderItems,
  payments,
}: {
  id: string;
  creationTime: Date | undefined;
  pendingSignature: boolean;
  orderItems: (OrderItem & { typeLabel: string })[];
  payments: {
    id: string;
    methodLabel: string;
    amount: number;
    confirmed: boolean;
  }[];
}) {
  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Stack>
        <Group justify={"space-between"}>
          <Title order={5} c={"dimmed"}>
            #{id}
          </Title>
          <Text>{norwegianTime(creationTime).format("DD/MM/YYYY HH:mm:ss")}</Text>
        </Group>
        <Activity mode={pendingSignature ? "visible" : "hidden"}>
          <WarningAlert title={"Denne orderen krever gyldig signatur"}>
            Du må ha en gyldig signatur før du kan motta disse bøkene. Sjekk dine oppgaver for mer
            informasjon
          </WarningAlert>
        </Activity>
        <Activity mode={!pendingSignature ? "visible" : "hidden"}>
          <Group gap={5}>
            <IconSignature />
            <Text c={"dimmed"}>Denne orderen krever ikke signering</Text>
          </Group>
        </Activity>
        <Stack gap={"xs"}>
          <Title order={5}>Bøker</Title>
          {orderItems.map((orderItem) => (
            <Card withBorder key={orderItem.title + orderItem.blid}>
              <Stack gap={5}>
                <Group justify={"space-between"}>
                  <Title order={6}>{orderItem.title}</Title>
                  <Activity mode={orderItem.amount ? "visible" : "hidden"}>
                    <Text>{Math.abs(orderItem.unitPrice)} kr</Text>
                  </Activity>
                </Group>
                <Activity mode={orderItem.blid ? "visible" : "hidden"}>
                  <Group gap={2}>
                    <IconQrcode size={18} />
                    <Text>{orderItem.blid}</Text>
                  </Group>
                </Activity>
                <Group gap={2}>
                  <OrderItemTypeIcon type={orderItem.type} />
                  <Text>{orderItem.typeLabel}</Text>
                  <Activity
                    mode={
                      ["rent", "partly-payment", "loan", "extend"].includes(orderItem.type) &&
                      orderItem.info?.to
                        ? "visible"
                        : "hidden"
                    }
                  >
                    til
                    <Text size={"sm"} fw={"bold"}>
                      {norwegianTime(orderItem.info?.to).format("DD/MM/YYYY")}
                    </Text>
                  </Activity>
                </Group>
                <Activity mode={orderItem.movedToOrder ? "visible" : "hidden"}>
                  <Text c={"dimmed"}>Denne boken har blitt flyttet til en annen ordre.</Text>
                </Activity>
              </Stack>
            </Card>
          ))}
        </Stack>
        <Activity mode={payments.length > 0 ? "visible" : "hidden"}>
          <Stack gap={5}>
            <Title order={5}>Betaling</Title>
            {payments.map((payment) => (
              <Card withBorder key={payment.id}>
                <Group justify={"space-between"}>
                  <Text key={payment.id}>
                    {payment.amount > 0 ? "Betalt" : "Refundert"} {Math.abs(payment.amount)} kr med{" "}
                    {payment.methodLabel}
                  </Text>
                  <Group gap={5}>
                    <Activity mode={payment.confirmed ? "visible" : "hidden"}>
                      <IconCheck color={"green"} />
                      <Text c={"green"}>Bekreftet</Text>
                    </Activity>
                    <Activity mode={!payment.confirmed ? "visible" : "hidden"}>
                      <IconExclamationMark />
                      <Text>Bekreftet</Text>
                    </Activity>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        </Activity>
      </Stack>
    </Card>
  );
}
