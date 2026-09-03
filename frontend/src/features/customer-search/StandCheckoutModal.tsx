import type { ActiveCustomerItem } from "@boklisten/backend/shared/customer-item/active-customer-item";
import type { CustomerItemAction } from "@boklisten/backend/shared/customer-item/actionable_customer_item";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import {
  Button,
  Divider,
  Group,
  List,
  Loader,
  Modal,
  Radio,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconCreditCard, IconSend } from "@tabler/icons-react";
import type { Route } from "@tuyau/core/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import OrderHistoryCard from "@/features/order-history/OrderHistoryCard";
import { formatAmount } from "@/features/order-history/orderHistoryGroups";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { norwegianTime } from "@/shared/utils/dayjs";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification } from "@/shared/utils/notifications";

/** Vipps' own orange, so the button reads as "this goes to Vipps" the way the app does. */
const VIPPS_ORANGE = "#ff5b24";
const STATUS_POLL_INTERVAL_MS = 2000;

type StandCheckoutState = Route.Response<"stand_checkout.status">;
type FailedStatus = Exclude<StandCheckoutState["status"], "pending" | "paid">;

export interface StandCheckoutRequest {
  book: ActiveCustomerItem;
  type: "extend" | "buyout";
}

/** An extend or buyout the book qualifies for, priced. */
type CheckoutOption = CustomerItemAction & { type: "extend" | "buyout"; to?: Date };

type Phase =
  | { kind: "confirm" }
  | { kind: "cardConfirm"; option: CheckoutOption }
  | { kind: "waiting"; orderId: string; phoneNumber: string; amount: number }
  | { kind: "done"; state: StandCheckoutState }
  | { kind: "failed"; status: FailedStatus };

const FAILURE_TITLES: Record<FailedStatus, string> = {
  aborted: "Kunden avviste forespørselen",
  expired: "Forespørselen utløp før kunden svarte",
  cancelled: "Forespørselen ble avbrutt",
};

function formatPhone(phoneNumber: string): string {
  const digits = phoneNumber.replaceAll(/\D/g, "").slice(-8);
  return digits.length === 8
    ? `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`
    : phoneNumber;
}

function formatDeadline(date: Date | string): string {
  return norwegianTime(date).format("DD.MM.YYYY");
}

function describe(request: StandCheckoutRequest, to: Date | undefined): string {
  return request.type === "extend" && to
    ? `Forleng «${request.book.title}» til ${formatDeadline(to)}`
    : `Kjøp ut «${request.book.title}»`;
}

function ConfirmStep({
  request,
  customer,
  phoneNumber,
  onPhoneNumberChange,
  onSendVipps,
  onChooseCard,
  sending,
}: {
  request: StandCheckoutRequest;
  customer: UserDetail;
  phoneNumber: string;
  onPhoneNumberChange: (phoneNumber: string) => void;
  onSendVipps: (option: CheckoutOption, phoneNumber: string) => void;
  onChooseCard: (option: CheckoutOption) => void;
  sending: boolean;
}) {
  const options = request.book.actions.filter(
    (action): action is CheckoutOption => action.type === request.type && action.available,
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = options[selectedIndex] ?? options[0];

  if (!selected) {
    return <ErrorAlert>Denne handlingen er ikke tilgjengelig for boka lenger.</ErrorAlert>;
  }

  const phoneIsValid = /^(?:\+?47)?\d{8}$/.test(phoneNumber.replaceAll(/\s/g, ""));

  return (
    <Stack>
      <Stack gap={4}>
        <Text fw={600} lh={1.3}>
          {describe(request, selected.to)}
        </Text>
        <Text size="sm" c="dimmed">
          for {customer.name}
        </Text>
      </Stack>

      {options.length > 1 && (
        <Radio.Group
          label="Ny frist"
          value={String(selectedIndex)}
          onChange={(value) => setSelectedIndex(Number(value))}
        >
          <Stack gap="xs" mt={6}>
            {options.map((option, index) => (
              <Radio
                key={option.to?.toISOString() ?? index}
                value={String(index)}
                label={`${option.to ? formatDeadline(option.to) : ""} – ${formatAmount(option.price)}`}
              />
            ))}
          </Stack>
        </Radio.Group>
      )}

      <Group justify="space-between" align="baseline">
        <Text>Å betale</Text>
        <Text fz={28} fw={700} lh={1}>
          {formatAmount(selected.price)}
        </Text>
      </Group>

      <Divider />

      <Stack gap="xs">
        <TextInput
          label="Kundens mobilnummer"
          description="Forespørselen sendes til Vipps på dette nummeret"
          value={phoneNumber}
          onChange={(event) => onPhoneNumberChange(event.currentTarget.value)}
          inputMode="tel"
          autoComplete="off"
          error={phoneNumber.length > 0 && !phoneIsValid ? "Skriv inn et norsk mobilnummer" : null}
        />
        <Button
          color={VIPPS_ORANGE}
          leftSection={<IconSend size={18} aria-hidden />}
          loading={sending}
          disabled={!phoneIsValid}
          onClick={() => onSendVipps(selected, phoneNumber)}
        >
          Send Vipps-forespørsel
        </Button>
      </Stack>

      <Divider label="eller" labelPosition="center" />

      <Button
        variant="default"
        leftSection={<IconCreditCard size={18} aria-hidden />}
        disabled={sending}
        onClick={() => onChooseCard(selected)}
      >
        Ta betalt med kort
      </Button>
    </Stack>
  );
}

/**
 * Card is taken in Vipps MobilePay's own app on the employee's phone, which nothing can open or
 * prefill from here. So the employee is walked through it and must vouch that it went through
 * before the order is placed.
 */
function CardConfirmStep({
  amount,
  onConfirm,
  onBack,
  busy,
}: {
  amount: number;
  onConfirm: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  return (
    <Stack>
      <Text fw={600}>Ta betalt {formatAmount(amount)} med kort</Text>
      <List type="ordered" spacing="xs">
        <List.Item>
          Åpne{" "}
          <Text span fw={600}>
            Vippskassa
          </Text>{" "}
          på telefonen din.
        </List.Item>
        <List.Item>Legg inn {formatAmount(amount)} og 0% Mva.</List.Item>
        <List.Item>Trykk på betal.</List.Item>
        <List.Item>La kunden tæppe kortet sitt eller telefonen sin for å ta betalt.</List.Item>
      </List>
      <Group justify="flex-end">
        <Button variant="default" onClick={onBack} disabled={busy}>
          Tilbake
        </Button>
        <Button
          leftSection={<IconCreditCard size={18} aria-hidden />}
          loading={busy}
          onClick={onConfirm}
        >
          Bekreft betaling
        </Button>
      </Group>
    </Stack>
  );
}

function WaitingStep({
  orderId,
  phoneNumber,
  amount,
  onSettled,
}: {
  orderId: string;
  phoneNumber: string;
  amount: number;
  onSettled: (state: StandCheckoutState) => void;
}) {
  const { api } = useApiClient();
  const { data, isError } = useQuery(
    api.standCheckout.status.queryOptions(
      { params: { orderId } },
      { refetchInterval: STATUS_POLL_INTERVAL_MS },
    ),
  );

  const cancelMutation = useMutation(
    api.standCheckout.cancel.mutationOptions({
      onSuccess: onSettled,
      onError: (error) =>
        showErrorNotification(errorMessage(error, "Klarte ikke avbryte forespørselen")),
    }),
  );

  useEffect(() => {
    if (data && data.status !== "pending") {
      onSettled(data);
    }
  }, [data, onSettled]);

  return (
    <Stack align="center" gap="md" py="md">
      <Loader color={VIPPS_ORANGE} type="dots" />
      <Stack gap={4} align="center">
        <Title order={3} ta="center">
          Venter på kunden
        </Title>
        <Text ta="center">
          Kunden har fått en forespørsel på {formatAmount(amount)} i Vipps på{" "}
          <Text span fw={600} style={{ whiteSpace: "nowrap" }}>
            {formatPhone(phoneNumber)}
          </Text>
          . Be kunden åpne Vipps og godkjenne betalingen.
        </Text>
        <Text size="sm" c="dimmed" ta="center">
          Forespørselen utløper etter 10 minutter.
        </Text>
      </Stack>
      {isError && <ErrorAlert>Klarte ikke hente betalingsstatus. Prøver igjen om litt.</ErrorAlert>}
      <Button
        variant="default"
        loading={cancelMutation.isPending}
        onClick={() => cancelMutation.mutate({ params: { orderId } })}
      >
        Avbryt forespørsel
      </Button>
    </Stack>
  );
}

function DoneStep({
  request,
  state,
  onClose,
}: {
  request: StandCheckoutRequest;
  state: StandCheckoutState;
  onClose: () => void;
}) {
  const newDeadline = state.order?.items.find((item) => item.type === "extend")?.period?.to;
  return (
    <Stack>
      <SuccessAlert title="Betalingen er registrert">
        {request.type === "extend" && newDeadline
          ? `Boka er forlenget til ${formatDeadline(newDeadline)}.`
          : "Boka er kjøpt ut."}{" "}
        Kunden får kvittering på e-post.
      </SuccessAlert>
      {state.order && (
        <OrderHistoryCard order={state.order} variant="admin" standalone defaultExpanded />
      )}
      <Button onClick={onClose}>Ferdig</Button>
    </Stack>
  );
}

function FailedStep({
  status,
  onRetry,
  onClose,
}: {
  status: FailedStatus;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <Stack>
      <ErrorAlert title={FAILURE_TITLES[status]}>
        Ingenting er betalt, og boka er uendret. Du kan sende en ny forespørsel eller registrere en
        kortbetaling.
      </ErrorAlert>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Lukk
        </Button>
        <Button onClick={onRetry}>Prøv igjen</Button>
      </Group>
    </Stack>
  );
}

function StandCheckoutFlow({
  request,
  customer,
  onClose,
  onWaitingChange,
}: {
  request: StandCheckoutRequest;
  customer: UserDetail;
  onClose: () => void;
  onWaitingChange: (waiting: boolean) => void;
}) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ kind: "confirm" });
  // Lives here so "Prøv igjen" comes back with the number the employee typed, not the one on file
  const [phoneNumber, setPhoneNumber] = useState(customer.phone ?? "");

  useEffect(() => {
    onWaitingChange(phase.kind === "waiting");
  }, [phase.kind, onWaitingChange]);

  function settle(state: StandCheckoutState) {
    if (state.status === "paid") {
      for (const key of [
        api.customerItems.getActiveCustomerItemsForCustomer.pathKey(),
        api.orderHistory.getForCustomer.pathKey(),
        api.orders.getPlacedOrders.pathKey(),
      ]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      setPhase({ kind: "done", state });
      return;
    }
    if (state.status !== "pending") {
      setPhase({ kind: "failed", status: state.status });
    }
  }

  const startMutation = useMutation(
    api.standCheckout.start.mutationOptions({
      onError: (error) =>
        showErrorNotification(errorMessage(error, "Klarte ikke starte betalingen")),
    }),
  );

  function start(
    option: CheckoutOption,
    payment: { method: "card" } | { method: "vipps"; phoneNumber: string },
  ) {
    startMutation.mutate(
      {
        body: {
          customerItemId: request.book.id,
          action:
            request.type === "extend" && option.to
              ? { type: "extend", to: norwegianTime(option.to).format("YYYY-MM-DD") }
              : { type: "buyout" },
          payment,
        },
      },
      {
        onSuccess: (state) => {
          if (state.status === "pending" && payment.method === "vipps") {
            setPhase({
              kind: "waiting",
              orderId: state.orderId,
              phoneNumber: payment.phoneNumber,
              amount: option.price,
            });
            return;
          }
          settle(state);
        },
      },
    );
  }

  switch (phase.kind) {
    case "confirm": {
      return (
        <ConfirmStep
          request={request}
          customer={customer}
          phoneNumber={phoneNumber}
          onPhoneNumberChange={setPhoneNumber}
          onSendVipps={(option, sendTo) => start(option, { method: "vipps", phoneNumber: sendTo })}
          onChooseCard={(option) => setPhase({ kind: "cardConfirm", option })}
          sending={startMutation.isPending}
        />
      );
    }
    case "cardConfirm": {
      return (
        <CardConfirmStep
          amount={phase.option.price}
          busy={startMutation.isPending}
          onBack={() => setPhase({ kind: "confirm" })}
          onConfirm={() => start(phase.option, { method: "card" })}
        />
      );
    }
    case "waiting": {
      return (
        <WaitingStep
          orderId={phase.orderId}
          phoneNumber={phase.phoneNumber}
          amount={phase.amount}
          onSettled={settle}
        />
      );
    }
    case "done": {
      return <DoneStep request={request} state={phase.state} onClose={onClose} />;
    }
    case "failed": {
      return (
        <FailedStep
          status={phase.status}
          onRetry={() => setPhase({ kind: "confirm" })}
          onClose={onClose}
        />
      );
    }
    default: {
      return null;
    }
  }
}

/**
 * Extend or buy out one of the customer's books at the stand: confirm what is being done and
 * the price, take payment by a Vipps request to the customer's phone or by card on the
 * terminal, and show the receipt.
 */
export default function StandCheckoutModal({
  request,
  customer,
  onClose,
}: {
  request: StandCheckoutRequest | null;
  customer: UserDetail;
  onClose: () => void;
}) {
  // While a request is out, the only way out is "Avbryt forespørsel", so the order never dangles
  const [waiting, setWaiting] = useState(false);

  return (
    <Modal
      opened={request !== null}
      onClose={onClose}
      title={request?.type === "extend" ? "Forleng bok" : "Kjøp ut bok"}
      closeOnClickOutside={!waiting}
      closeOnEscape={!waiting}
      withCloseButton={!waiting}
    >
      {request && (
        <StandCheckoutFlow
          key={`${request.book.id}-${request.type}`}
          request={request}
          customer={customer}
          onClose={onClose}
          onWaitingChange={setWaiting}
        />
      )}
    </Modal>
  );
}
