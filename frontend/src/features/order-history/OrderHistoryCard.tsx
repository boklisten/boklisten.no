import type {
  OrderHistoryEntry,
  OrderHistoryItem,
  OrderHistoryParty,
  OrderHistoryPayment,
} from "@boklisten/backend/shared/order/order-history";
import {
  ActionIcon,
  Anchor,
  Card,
  Collapse,
  CopyButton,
  Divider,
  Group,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import type { ReactNode } from "react";
import { IconCheck, IconChevronDown, IconCopy, IconExclamationCircle } from "@tabler/icons-react";
import { useState } from "react";

import OrderBranchChip from "@/features/order-history/OrderBranchChip";
import { DeliveryBadge, PaymentStatusBadge } from "@/features/order-history/OrderStatusBadges";
import { capitalize, formatAmount, pluralBooks } from "@/features/order-history/orderHistoryGroups";
import EntityLink from "@/shared/components/EntityLink";
import OrderItemTypeIcon from "@/shared/components/OrderItemTypeIcon";
import useAuth from "@/shared/hooks/useAuth";
import { norwegianTime } from "@/shared/utils/dayjs";

/** Admin cards link to books and people and can move the order; customer cards only tell. */
export type OrderHistoryVariant = "admin" | "customer";

interface OrderHistoryCardProps {
  order: OrderHistoryEntry;
  variant: OrderHistoryVariant;
  /** Orders shown in the same list, so a moved item can link to the order it went to. */
  listedOrderIds?: ReadonlySet<string>;
  onRevealOrder?: (orderId: string) => void;
  /** Controlled expansion; when omitted the card manages its own state. */
  expanded?: boolean;
  onToggle?: () => void;
  defaultExpanded?: boolean;
  /** Show the full date in the header, for a card that is not under a day heading. */
  standalone?: boolean;
}

/** Only the moved-item notes need to know about other orders. */
interface OrderLinking {
  listedOrderIds: ReadonlySet<string> | undefined;
  onRevealOrder: ((orderId: string) => void) | undefined;
}

function formatDate(isoTime: string): string {
  return norwegianTime(isoTime).format("D. MMM YYYY");
}

function summaryLine(order: OrderHistoryEntry): string {
  const { items } = order;
  const types = new Set(items.map((item) => item.typeLabel));
  const kind = types.size === 1 ? capitalize(items[0]!.typeLabel) : "Flere typer";
  return [
    kind,
    pluralBooks(items.length),
    items[0]?.title,
    items.length > 2 ? `+${items.length - 1} til` : items[1]?.title,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The item's type and the fact that follows from it: deadline, amount left, buyback sum. */
function itemDescription(item: OrderHistoryItem): string {
  // A received match book is a loan like any other; who it came from is the note below.
  const parts = [item.type === "match-receive" ? "Lån" : capitalize(item.typeLabel)];
  if (item.period) {
    parts[0] += ` til ${formatDate(item.period.to)}`;
  }
  if (item.amountLeftToPay !== null && item.amountLeftToPay > 0) {
    parts.push(`${item.amountLeftToPay} kr igjen å betale`);
  }
  if (item.type === "buyback" && item.buybackAmount !== null) {
    parts.push(`${item.buybackAmount} kr`);
  }
  return parts.join(" · ");
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text size="xs" fw={700} c="dimmed" tt="uppercase">
      {children}
    </Text>
  );
}

function PersonName({
  party,
  variant,
}: {
  party: OrderHistoryParty;
  variant: OrderHistoryVariant;
}) {
  if (variant === "customer") {
    return party.name;
  }
  return (
    <EntityLink to="/admin/kasse" search={{ kunde: party.detailsId }} size="inherit">
      {party.name}
    </EntityLink>
  );
}

/** Names the other order by its ID; a link when that order is in the same list. */
function OrderLink({
  orderId,
  linking: { listedOrderIds, onRevealOrder },
}: {
  orderId: string;
  linking: OrderLinking;
}) {
  if (!listedOrderIds?.has(orderId) || onRevealOrder === undefined) {
    return (
      <Text span ff="monospace" fz="inherit">
        {orderId}
      </Text>
    );
  }
  return (
    <Anchor
      component="button"
      type="button"
      fz="inherit"
      c="inherit"
      fw={600}
      ff="monospace"
      underline="hover"
      onClick={() => onRevealOrder(orderId)}
    >
      {orderId}
    </Anchor>
  );
}

function ItemRow({
  item,
  byMail,
  variant,
  linking,
}: {
  item: OrderHistoryItem;
  /** The order was shipped, so the stand never handed the book over in person. */
  byMail: boolean;
  variant: OrderHistoryVariant;
  linking: OrderLinking;
}) {
  // An online order waits at the stand until a scan moves its items into a handout order.
  const awaitingHandout =
    (item.type === "rent" || item.type === "partly-payment" || item.type === "buy") &&
    item.movedToOrderId === null &&
    !item.handout &&
    !item.delivered &&
    !byMail;

  // The transfer counterparty is part of what happened; move links and handout state are
  // bookkeeping and step back behind the type line.
  const notes: { content: ReactNode; quiet: boolean }[] = [];
  const note = (content: ReactNode, quiet: boolean) => notes.push({ content, quiet });
  if (item.transfer) {
    const verb = item.transfer.direction === "received" ? "Mottatt fra" : "Levert til";
    note(
      item.transfer.counterparty ? (
        <>
          {verb} <PersonName party={item.transfer.counterparty} variant={variant} /> kl.{" "}
          {norwegianTime(item.transfer.time).format("HH:mm")}
        </>
      ) : (
        `${verb} en annen elev`
      ),
      false,
    );
  }
  if (item.movedToOrderId !== null) {
    note(
      <>
        Flyttet til ordre <OrderLink orderId={item.movedToOrderId} linking={linking} />
      </>,
      true,
    );
  }
  if (item.movedFromOrderId !== null) {
    note(
      <>
        Flyttet fra ordre <OrderLink orderId={item.movedFromOrderId} linking={linking} />
      </>,
      true,
    );
  }
  if (awaitingHandout) {
    note("Ikke utlevert", true);
  }

  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <Text c="dimmed" mt={2} lh={1}>
          <OrderItemTypeIcon type={item.type} />
        </Text>
        <Stack gap={2} miw={0}>
          {/* The unique ID sits with the title, never with the type line: "Overlevert til elev
              87767394" reads as if the book went to the number. */}
          <Group gap="xs" wrap="wrap" align="center">
            <Text fw={500} lh={1.3}>
              {item.title}
            </Text>
            {item.blid &&
              (variant === "admin" ? (
                <EntityLink
                  to="/admin/kasse"
                  search={{ blid: item.blid }}
                  size="sm"
                  ff="monospace"
                  lh={1.3}
                  aria-label={`Se historikken til bok ${item.blid}`}
                >
                  {item.blid}
                </EntityLink>
              ) : (
                <Text size="sm" c="dimmed" ff="monospace" lh={1.3}>
                  {item.blid}
                </Text>
              ))}
          </Group>
          <Text size="sm">{itemDescription(item)}</Text>
          {notes.map(({ content, quiet }, index) => (
            // Notes have no identity of their own; order within one row is stable.
            // oxlint-disable-next-line react/no-array-index-key
            <Text key={index} size={quiet ? "xs" : "sm"} c={quiet ? "dimmed" : undefined}>
              {content}
            </Text>
          ))}
        </Stack>
      </Group>
      {item.amount !== 0 && (
        <Text fw={500} flex="none">
          {formatAmount(item.amount)}
        </Text>
      )}
    </Group>
  );
}

function PaymentRow({
  payment,
  variant,
}: {
  payment: OrderHistoryPayment;
  variant: OrderHistoryVariant;
}) {
  const text = [
    `${payment.amount < 0 ? "Refundert" : "Betalt"} ${Math.abs(payment.amount)} kr med ${payment.methodLabel}`,
    variant === "admin" ? payment.branchName : null,
    payment.time ? norwegianTime(payment.time).format("D. MMM [kl.] HH:mm") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // Legacy gateway payments are usually flagged unconfirmed although the order went through, so
  // the warning is reserved for methods where the flag is still maintained.
  const warn = !payment.confirmed && payment.method !== "dibs";
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text size="sm">{text}</Text>
      {warn ? (
        <Group gap={4} wrap="nowrap">
          <IconExclamationCircle size={16} color="var(--mantine-color-yellow-7)" />
          <Text size="xs" c="dimmed">
            Ikke bekreftet
          </Text>
        </Group>
      ) : (
        <IconCheck size={16} color="var(--mantine-color-green-7)" aria-label="Bekreftet" />
      )}
    </Group>
  );
}

function PaymentsSection({
  order,
  variant,
}: {
  order: OrderHistoryEntry;
  variant: OrderHistoryVariant;
}) {
  if (order.paymentStatus === "free" && order.payments.length === 0) {
    return null;
  }
  return (
    <Stack gap={6}>
      <SectionLabel>Betaling</SectionLabel>
      {order.payments.map((payment) => (
        <PaymentRow key={payment.id} payment={payment} variant={variant} />
      ))}
      {order.paymentStatus === "invoice" && <Text size="sm">Beløpet ble betalt via faktura.</Text>}
      {order.paymentStatus === "unpaid" && order.payments.length === 0 && (
        <Text size="sm" c="red">
          Ingen betaling er registrert på ordren.
        </Text>
      )}
    </Stack>
  );
}

function DeliverySection({ order }: { order: OrderHistoryEntry }) {
  const { delivery } = order;
  if (delivery === null) {
    return null;
  }
  return (
    <Stack gap={6}>
      <SectionLabel>Levering</SectionLabel>
      {delivery.method === "branch" && (
        <Text size="sm">Hentes på {delivery.branchName ?? "filialen"}</Text>
      )}
      {delivery.method === "missing" && (
        <Text size="sm" c="red">
          Sendt i posten, men leveringsinformasjonen mangler.
        </Text>
      )}
      {delivery.method === "bring" && (
        <Stack gap={2}>
          <Text size="sm">
            Sendt i posten
            {delivery.productLabel && ` som ${delivery.productLabel}`}
            {delivery.amount > 0 && ` · frakt ${delivery.amount} kr`}
          </Text>
          {delivery.trackingNumber && (
            <Text size="sm">
              Sporingsnummer{" "}
              <Anchor
                href={`https://sporing.bring.no/sporing/${delivery.trackingNumber}`}
                target="_blank"
                rel="noreferrer"
                size="sm"
                ff="monospace"
              >
                {delivery.trackingNumber}
              </Anchor>
            </Text>
          )}
          {delivery.estimatedDelivery && (
            <Text size="sm" c="dimmed">
              Forventet levert {formatDate(delivery.estimatedDelivery)}
            </Text>
          )}
          {delivery.shipmentAddress && (
            <Text size="sm" c="dimmed">
              {delivery.shipmentAddress.name}, {delivery.shipmentAddress.address},{" "}
              {delivery.shipmentAddress.postalCode} {delivery.shipmentAddress.postalCity}
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function DetailsSection({
  order,
  variant,
}: {
  order: OrderHistoryEntry;
  variant: OrderHistoryVariant;
}) {
  const { isAdmin } = useAuth();
  const placedBy = order.byCustomer ? (
    variant === "customer" ? (
      "Bestilt av deg"
    ) : (
      "Bestilt av kunden"
    )
  ) : order.employee ? (
    <>
      Registrert av ansatt <PersonName party={order.employee} variant={variant} />
    </>
  ) : (
    "Registrert av ansatt på stand"
  );

  return (
    <Stack gap={6}>
      <SectionLabel>Detaljer</SectionLabel>
      <Text size="sm">{placedBy}</Text>
      {/* The branch is already in the card header; only the admin's control to move it is new. */}
      {variant === "admin" && isAdmin && (
        <Group gap={6}>
          <OrderBranchChip
            orderId={order.id}
            branchId={order.branch.id}
            branchName={order.branch.name}
          />
        </Group>
      )}
      {order.emailSuppressed && (
        <Text size="sm" c="dimmed">
          Ingen e-post ble sendt for denne ordren.
        </Text>
      )}
      {order.checkoutState && (
        <Text size="sm" c="dimmed">
          Vipps: {order.checkoutState}
        </Text>
      )}
      {/* Last and quiet: staff copy it into other tools, nobody reads it. */}
      <Group gap={4} wrap="nowrap">
        <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
          Ordre-ID{" "}
          <Text span ff="monospace" fz="inherit">
            {order.id}
          </Text>
        </Text>
        <CopyButton value={order.id}>
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
  );
}

export default function OrderHistoryCard({
  order,
  variant,
  listedOrderIds,
  onRevealOrder,
  expanded,
  onToggle,
  defaultExpanded = false,
  standalone = false,
}: OrderHistoryCardProps) {
  const [ownExpanded, setOwnExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? ownExpanded;
  const toggle = onToggle ?? (() => setOwnExpanded((previous) => !previous));
  const created = norwegianTime(order.creationTime);

  return (
    <Card id={`ordre-${order.id}`} shadow="sm" padding={0} radius="md" withBorder>
      <UnstyledButton onClick={toggle} aria-expanded={isExpanded} p="md" w="100%">
        <Group wrap="nowrap" gap="md" align="flex-start">
          <Text
            fz="sm"
            fw={600}
            ff="monospace"
            c="dimmed"
            lh={1.4}
            flex="none"
            miw={standalone ? undefined : 44}
          >
            {standalone ? created.format("D. MMM YYYY HH:mm") : created.format("HH:mm")}
          </Text>
          <Stack gap={4} flex={1} miw={0}>
            <Text fw={600} lh={1.4}>
              {order.branch.name}
            </Text>
            <Text size="sm" c="dimmed" lineClamp={2}>
              {summaryLine(order)}
            </Text>
            {/* A phone has no room for a right-hand column: amount and chips join the stack. */}
            <Group gap={6} hiddenFrom="sm">
              {order.amount !== 0 && (
                <Text size="sm" fw={600}>
                  {formatAmount(order.amount)}
                </Text>
              )}
              <PaymentStatusBadge status={order.paymentStatus} />
              <DeliveryBadge order={order} />
            </Group>
          </Stack>
          <Stack gap={4} align="flex-end" flex="none" visibleFrom="sm">
            {order.amount !== 0 && (
              <Text fw={600} lh={1.4}>
                {formatAmount(order.amount)}
              </Text>
            )}
            <Group gap={6} justify="flex-end">
              <PaymentStatusBadge status={order.paymentStatus} />
              <DeliveryBadge order={order} />
            </Group>
          </Stack>
          <IconChevronDown
            size={20}
            style={{
              transform: isExpanded ? "rotate(180deg)" : undefined,
              transition: "transform 150ms ease",
              flex: "none",
              marginTop: 2,
            }}
          />
        </Group>
      </UnstyledButton>
      <Collapse expanded={isExpanded}>
        <Divider />
        <Stack p="md" gap="md">
          <Stack gap="sm">
            {order.items.map((item, index) => (
              <Stack gap="sm" key={`${item.itemId}-${item.blid ?? index}`}>
                {index > 0 && <Divider variant="dashed" />}
                <ItemRow
                  item={item}
                  byMail={order.delivery !== null && order.delivery.method !== "branch"}
                  variant={variant}
                  linking={{ listedOrderIds, onRevealOrder }}
                />
              </Stack>
            ))}
          </Stack>
          <PaymentsSection order={order} variant={variant} />
          <DeliverySection order={order} />
          <DetailsSection order={order} variant={variant} />
        </Stack>
      </Collapse>
    </Card>
  );
}
