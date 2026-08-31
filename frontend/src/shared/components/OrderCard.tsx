import type { OrderItem } from "@boklisten/backend/shared/order/order-item/order-item";
import {
  ActionIcon,
  Card,
  Collapse,
  CopyButton,
  Divider,
  Group,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconExclamationCircle,
  IconQrcode,
} from "@tabler/icons-react";
import { useState } from "react";

import OrderItemTypeIcon from "@/shared/components/OrderItemTypeIcon";
import { norwegianTime } from "@/shared/utils/dayjs";

export default function OrderCard({
  id,
  creationTime,
  orderItems,
  payments,
  branchName,
  defaultExpanded = false,
}: {
  id: string;
  creationTime: Date | undefined;
  orderItems: (OrderItem & { typeLabel: string })[];
  payments: {
    id: string;
    methodLabel: string;
    amount: number;
    confirmed: boolean;
  }[];
  branchName?: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const created = norwegianTime(creationTime);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const bookCount = orderItems.length;
  const bookSummary = [
    bookCount === 1 ? "1 bok" : `${bookCount} bøker`,
    orderItems[0]?.title,
    bookCount > 2 ? `+${bookCount - 1} til` : orderItems[1]?.title,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card shadow="sm" padding={0} radius="md" withBorder>
      <UnstyledButton
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
        p="md"
        w="100%"
      >
        <Group wrap="nowrap" gap="md">
          <Stack gap={0} align="center" miw={52}>
            <Text fz={26} fw={700} lh={1.1}>
              {created.format("D")}
            </Text>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              {created.format("MMM YYYY")}
            </Text>
          </Stack>
          <Divider orientation="vertical" />
          <Stack gap={2} flex={1} miw={0}>
            <Group gap="xs" wrap="nowrap">
              <Text fw={600} truncate>
                {branchName ?? "Bestilling"}
              </Text>
            </Group>
            <Text size="sm" c="dimmed" truncate>
              {bookSummary}
            </Text>
          </Stack>
          {totalPaid !== 0 && (
            <Text fw={600} flex="none">
              {totalPaid < 0 ? `−${Math.abs(totalPaid)}` : totalPaid} kr
            </Text>
          )}
          <IconChevronDown
            size={20}
            style={{
              transform: expanded ? "rotate(180deg)" : undefined,
              transition: "transform 150ms ease",
              flex: "none",
            }}
          />
        </Group>
      </UnstyledButton>
      <Collapse expanded={expanded}>
        <Divider />
        <Stack p="md" gap="sm">
          <Stack gap="sm">
            {orderItems.map((orderItem, index) => (
              <Stack gap="sm" key={orderItem.title + orderItem.blid}>
                {index > 0 && <Divider />}
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={500}>{orderItem.title}</Text>
                    <Group gap={5}>
                      <OrderItemTypeIcon type={orderItem.type} />
                      <Text size="sm" c="dimmed">
                        {orderItem.typeLabel}
                        {["rent", "partly-payment", "extend"].includes(orderItem.type) &&
                          orderItem.info?.to &&
                          ` til ${norwegianTime(orderItem.info.to).format("D. MMM YYYY")}`}
                      </Text>
                    </Group>
                    {orderItem.blid && (
                      <Group gap={4}>
                        <IconQrcode size={14} />
                        <Text size="xs" c="dimmed">
                          {orderItem.blid}
                        </Text>
                      </Group>
                    )}
                    {orderItem.movedToOrder && (
                      <Text size="xs" c="dimmed">
                        Denne boken har blitt flyttet til en annen ordre
                      </Text>
                    )}
                  </Stack>
                  {orderItem.amount !== 0 && (
                    <Text fw={500} flex="none">
                      {Math.abs(orderItem.unitPrice)} kr
                    </Text>
                  )}
                </Group>
              </Stack>
            ))}
          </Stack>
          {payments.length > 0 && (
            <>
              <Divider />
              <Stack gap={5}>
                {payments.map((payment) => (
                  <Group justify="space-between" key={payment.id}>
                    <Text size="sm">
                      {payment.amount > 0 ? "Betalt" : "Refundert"} {Math.abs(payment.amount)} kr
                      med {payment.methodLabel}
                    </Text>
                    {payment.confirmed ? (
                      <Group gap={4}>
                        <IconCheck size={16} color="var(--mantine-color-green-7)" />
                        <Text size="xs" c="green">
                          Bekreftet
                        </Text>
                      </Group>
                    ) : (
                      <Group gap={4}>
                        <IconExclamationCircle size={16} color="var(--mantine-color-yellow-7)" />
                        <Text size="xs" c="dimmed">
                          Ikke bekreftet
                        </Text>
                      </Group>
                    )}
                  </Group>
                ))}
              </Stack>
            </>
          )}
          <Group gap={4}>
            <Text size="xs" c="dimmed">
              Ordre-ID: {id}
            </Text>
            <CopyButton value={id}>
              {({ copied, copy }) => (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={copy}
                  aria-label="Kopier ordre-ID"
                >
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                </ActionIcon>
              )}
            </CopyButton>
          </Group>
        </Stack>
      </Collapse>
    </Card>
  );
}
