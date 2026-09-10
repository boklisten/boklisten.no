import type { StandCartCheckoutState } from "@boklisten/backend/shared/stand_cart";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import {
  Anchor,
  Button,
  Center,
  Collapse,
  Divider,
  Group,
  List,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useOs } from "@mantine/hooks";
import {
  IconCash,
  IconCheck,
  IconCreditCard,
  IconExternalLink,
  IconHandStop,
  IconTruck,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import OrderHistoryCard from "@/features/order-history/OrderHistoryCard";
import { TotalHero } from "@/features/stand-cart/StandCartAmounts";
import RefundStep from "@/features/stand-cart/StandCartRefund";
import { formatAmount } from "@/features/stand-cart/standCartLabels";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import { isPlaced } from "@/features/stand-cart/useStandCartSubmit";
import type {
  Delivery,
  FailedStatus,
  Payment,
  StandCartSubmitter,
} from "@/features/stand-cart/useStandCartSubmit";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import VippsStyledButton, { VIPPS_ORANGE } from "@/shared/components/VippsStyledButton";
import MonitoringNotice from "@/shared/components/MonitoringNotice";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification } from "@/shared/utils/notifications";

const STATUS_POLL_INTERVAL_MS = 2000;

const VIPPSKASSA_APP_STORE_URL = "https://apps.apple.com/no/app/mobile-point-of-sale/id6472654638";
const VIPPSKASSA_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.vippsmobilepay.vmpos";

/** Where the payment stands, within the "Betaling" step. */
type PayPhase =
  | { kind: "choose" }
  | { kind: "cardConfirm" }
  | { kind: "cashConfirm" }
  | { kind: "waiting"; orderId: string; phoneNumber: string }
  | { kind: "failed"; status: FailedStatus };

/** The steps after the cart. */
export type CheckoutStep = "delivery" | "pay" | "done";

const FAILURE_TITLES: Record<FailedStatus, string> = {
  aborted: "Kunden avviste forespørselen",
  expired: "Forespørselen utløp før kunden svarte",
  cancelled: "Forespørselen ble avbrutt",
};

/** An amount inside an instruction, in bold, so the sum to key in stands out of the sentence. */
function Sum({ amount }: { amount: number }) {
  return (
    <Text span fw={700}>
      {formatAmount(amount)}
    </Text>
  );
}

/** Marks a link that leaves the drawer for another tab, so the employee is not surprised. */
function NewTabIcon() {
  return (
    <IconExternalLink
      size={14}
      aria-hidden
      style={{ marginInlineStart: 3, verticalAlign: "-0.15em" }}
    />
  );
}

/**
 * The button that moves the flow on, centred and named after where it goes: the next step, or
 * "Bekreft" when nothing is left to pay and the cart becomes an order right here.
 */
export function NextStepButton({
  to,
  onClick,
  disabled,
  loading,
}: {
  to: "delivery" | "pay" | "confirm";
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { label, icon: Icon, color } = NEXT_STEPS[to];
  return (
    <Group justify="center">
      <Button
        color={color}
        leftSection={<Icon size={18} aria-hidden />}
        disabled={disabled}
        loading={loading}
        onClick={onClick}
      >
        {label}
      </Button>
    </Group>
  );
}

const NEXT_STEPS = {
  delivery: { label: "Gå til levering", icon: IconTruck, color: undefined },
  pay: { label: "Gå til betaling", icon: IconCreditCard, color: undefined },
  confirm: { label: "Bekreft", icon: IconCheck, color: "green" },
} as const;

function formatPhone(phoneNumber: string): string {
  const digits = phoneNumber.replaceAll(/\D/g, "").slice(-8);
  return digits.length === 8
    ? `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`
    : phoneNumber;
}

/** How a mail order leaves the stand: in the post, the norm, or straight into the customer's hands. */
type DeliveryMode = "post" | "stand";

const DELIVERY_MODES: Record<DeliveryMode, { label: string; icon: typeof IconTruck }> = {
  post: { label: "Send i posten", icon: IconTruck },
  stand: { label: "Del ut på stand", icon: IconHandStop },
};

/**
 * A mail order in the cart: sending it is the norm and needs the tracking number, so the field
 * unfolds for that choice and folds away when the books are handed over at the stand instead.
 * With nothing to pay, the order is placed from here.
 */
function DeliveryStep({
  nothingToPay,
  busy,
  onNext,
}: {
  nothingToPay: boolean;
  busy: boolean;
  onNext: (delivery: Delivery) => void;
}) {
  const [mode, setMode] = useState<DeliveryMode>("post");
  const [trackingNumber, setTrackingNumber] = useState("");
  const sending = mode === "post";
  const trimmed = trackingNumber.trim();
  return (
    <Stack>
      {/* The drawer's own title already says "Levering", so the control is named only for assistive tech */}
      <SegmentedControl
        aria-label="Levering"
        fullWidth
        value={mode}
        onChange={(next) => setMode(next === "stand" ? "stand" : "post")}
        disabled={busy}
        data={(["post", "stand"] as const).map((option) => {
          const { label, icon: IconComponent } = DELIVERY_MODES[option];
          return {
            value: option,
            label: (
              <Center style={{ gap: 6 }}>
                <IconComponent size={16} aria-hidden />
                <span>{label}</span>
              </Center>
            ),
          };
        })}
      />
      <Collapse expanded={sending}>
        <TextInput
          label="Sporingsnummer"
          description="Kunden får en e-post med sporingsnummeret i stedet for en vanlig kvittering"
          value={trackingNumber}
          onChange={(event) => setTrackingNumber(event.currentTarget.value)}
          autoComplete="off"
          required
          data-autofocus
        />
      </Collapse>
      <NextStepButton
        to={nothingToPay ? "confirm" : "pay"}
        disabled={sending && trimmed === ""}
        loading={busy}
        onClick={() => onNext(sending ? { trackingNumber: trimmed } : null)}
      />
    </Stack>
  );
}

function PayStep({
  phoneNumber,
  onPay,
  onChooseCard,
  onChooseCash,
  busy,
}: {
  phoneNumber: string;
  onPay: (payment: Payment) => void;
  onChooseCard: () => void;
  onChooseCash: () => void;
  busy: boolean;
}) {
  const form = useAppForm({
    defaultValues: { phoneNumber },
    onSubmit: ({ value }) => onPay({ method: "vipps", phoneNumber: value.phoneNumber }),
  });

  return (
    <Stack>
      <Stack gap="xs">
        {/* Named the way the card and cash instructions are, so the three read as siblings */}
        <Title order={4}>Ta betalt med Vipps</Title>
        <form.AppField
          name="phoneNumber"
          validators={{ onSubmit: ({ value }) => phoneNumberFieldValidator(value, "personal") }}
        >
          {(field) => (
            <field.PhoneNumberField
              label="Kundens mobilnummer"
              description="Forespørselen sendes på Vipps til dette nummeret"
              autoComplete="off"
            />
          )}
        </form.AppField>
        <VippsStyledButton loading={busy} onClick={() => void form.handleSubmit()}>
          Send Vipps-forespørsel
        </VippsStyledButton>
      </Stack>
      <Divider label="eller" labelPosition="center" />
      <Group grow>
        <Button
          variant="default"
          leftSection={<IconCreditCard size={18} aria-hidden />}
          disabled={busy}
          onClick={onChooseCard}
        >
          Kort
        </Button>
        <Button
          variant="default"
          leftSection={<IconCash size={18} aria-hidden />}
          disabled={busy}
          onClick={onChooseCash}
        >
          Kontant
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Card is taken in Vipps's own app on the employee's phone, which nothing can prefill from here,
 * so the employee is walked through it and must vouch that it went through.
 */
function CardConfirmStep({
  amount,
  onConfirm,
  busy,
}: {
  amount: number;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Stack>
      <Title order={4}>Ta betalt med kort</Title>
      <List type="ordered" spacing="xs">
        <List.Item>
          Åpne <VippskassaLink /> på telefonen din.
        </List.Item>
        <List.Item>
          Legg inn <Sum amount={amount} /> og 0% Mva.
        </List.Item>
        <List.Item>Trykk på betal.</List.Item>
        <List.Item>La kunden tæppe kortet sitt eller telefonen sin for å ta betalt.</List.Item>
      </List>
      <Group justify="flex-end">
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

/**
 * Cash changes hands outside any app, so the employee is walked through taking it and must vouch
 * that the money is in the till before the order is recorded as paid.
 */
function CashConfirmStep({
  amount,
  onConfirm,
  busy,
}: {
  amount: number;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Stack>
      <Title order={4}>Ta betalt kontant</Title>
      <List type="ordered" spacing="xs">
        <List.Item>
          Ta imot <Sum amount={amount} /> fra kunden.
        </List.Item>
        <List.Item>Tell opp pengene og gi tilbake eventuelle vekslepenger.</List.Item>
        <List.Item>Legg pengene i kassen.</List.Item>
      </List>
      <MonitoringNotice />
      <Group justify="flex-end">
        <Button leftSection={<IconCash size={18} aria-hidden />} loading={busy} onClick={onConfirm}>
          Bekreft betaling
        </Button>
      </Group>
    </Stack>
  );
}

/** Vippskassa on the employee's phone, linked to the store for whichever phone they hold. */
function VippskassaLink() {
  const os = useOs();
  const storeUrl = os === "ios" ? VIPPSKASSA_APP_STORE_URL : VIPPSKASSA_PLAY_STORE_URL;
  return (
    <Anchor href={storeUrl} target="_blank" rel="noreferrer" c="inherit" fw={600} underline="hover">
      Vippskassa
      <NewTabIcon />
    </Anchor>
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
  onSettled: (state: StandCartCheckoutState) => void;
}) {
  const { api } = useApiClient();
  const { data, isError } = useQuery(
    api.standCart.status.queryOptions(
      { params: { orderId } },
      { refetchInterval: STATUS_POLL_INTERVAL_MS },
    ),
  );
  const cancelMutation = useMutation(
    api.standCart.cancel.mutationOptions({
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
          Kunden har fått en forespørsel på <Sum amount={amount} /> i Vipps på{" "}
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

function doneTitle(state: StandCartCheckoutState): string {
  if (state.order !== null && state.order.amount < 0) {
    const methods = new Set(state.order.payments.map((payment) => payment.method));
    const byTransfer = methods.has("bank-transfer");
    const byVipps = methods.has("vipps-epayment") || methods.has("vipps-checkout");
    if (byTransfer && byVipps) {
      return "Deler av refusjonen er sendt via Vipps, resten til administrator";
    }
    return byTransfer
      ? "Refusjonsforespørselen er sendt til administrator"
      : "Refusjonen er sendt via Vipps";
  }
  return state.status === "paid" ? "Betalingen er registrert" : "Ordren er registrert";
}

function DoneStep({ state, onClose }: { state: StandCartCheckoutState; onClose: () => void }) {
  return (
    <Stack>
      <SuccessAlert title={doneTitle(state)}>
        {/* The order card below already says the customer gets the receipt by e-mail */}
        {state.order === null && "Endringene er lagret."}
      </SuccessAlert>
      {state.order && (
        <OrderHistoryCard order={state.order} variant="admin" standalone defaultExpanded readOnly />
      )}
      <Button onClick={onClose}>Ferdig</Button>
    </Stack>
  );
}

/** A Vipps request that came to nothing: back to the ways of paying, by the same button as before. */
function FailedStep({ status, onRetry }: { status: FailedStatus; onRetry: () => void }) {
  return (
    <Stack>
      <ErrorAlert title={FAILURE_TITLES[status]}>
        Ingenting er betalt, og bøkene er uendret. Du kan sende en ny forespørsel eller velge en
        annen betalingsmåte.
      </ErrorAlert>
      <NextStepButton to="pay" onClick={onRetry} />
    </Stack>
  );
}

/**
 * The "Betaling" step: how the customer pays, the wait for Vipps, and the retry when that fails.
 * The total stays in view whichever way the money is taken, so the sub-steps need not repeat it.
 */
function PayFlow({
  cart,
  customer,
  delivery,
  submitter,
  onPlaced,
  onBack,
  onBackChange,
  onWaitingChange,
}: {
  cart: StandCart;
  customer: UserDetail;
  delivery: Delivery;
  submitter: StandCartSubmitter;
  onPlaced: (state: StandCartCheckoutState) => void;
  /** Leaves the payment step for the one before it. */
  onBack: () => void;
  /**
   * The drawer's title holds the way back. Within the step it returns to the choice of method,
   * from the choice to the step before, and while a Vipps request is out there is none.
   */
  onBackChange: (back: (() => void) | null) => void;
  onWaitingChange: (waiting: boolean) => void;
}) {
  const [phase, setPhase] = useState<PayPhase>({ kind: "choose" });
  // Kept across attempts so "Gå til betaling" comes back with the number last sent, not the one on file
  const [phoneNumber, setPhoneNumber] = useState(customer.phone ?? "");

  useEffect(() => {
    onWaitingChange(phase.kind === "waiting");
  }, [phase.kind, onWaitingChange]);

  useEffect(() => {
    if (phase.kind === "waiting") {
      onBackChange(null);
    } else if (phase.kind === "choose") {
      onBackChange(onBack);
    } else {
      onBackChange(() => setPhase({ kind: "choose" }));
    }
  }, [phase.kind, onBack, onBackChange]);

  function settle(state: StandCartCheckoutState) {
    submitter.settle(state);
    switch (state.status) {
      case "paid":
      case "placed": {
        onPlaced(state);
        break;
      }
      case "pending": {
        break;
      }
      default: {
        setPhase({ kind: "failed", status: state.status });
      }
    }
  }

  /** Resolves with whether the order went through; a Vipps push is not through until the customer answers. */
  async function pay(payment: Payment): Promise<boolean> {
    if (payment.method === "vipps" && payment.phoneNumber !== undefined) {
      setPhoneNumber(payment.phoneNumber);
    }
    const state = await submitter.submit(payment, delivery);
    if (state === null) {
      return false;
    }
    if (state.status === "pending" && payment.method === "vipps" && payment.phoneNumber) {
      setPhase({ kind: "waiting", orderId: state.orderId, phoneNumber: payment.phoneNumber });
      return false;
    }
    settle(state);
    return isPlaced(state);
  }

  return (
    <Stack>
      <TotalHero cart={cart} />
      <Divider />
      {payPhaseContent()}
    </Stack>
  );

  // Not a component: a nested one would remount, and with it the phone number being typed
  function payPhaseContent() {
    switch (phase.kind) {
      case "choose": {
        if (cart.total < 0) {
          return (
            <RefundStep cart={cart} customer={customer} busy={submitter.isPending} onPay={pay} />
          );
        }
        return (
          <PayStep
            phoneNumber={phoneNumber}
            onPay={(payment) => void pay(payment)}
            onChooseCard={() => setPhase({ kind: "cardConfirm" })}
            onChooseCash={() => setPhase({ kind: "cashConfirm" })}
            busy={submitter.isPending}
          />
        );
      }
      case "cardConfirm": {
        return (
          <CardConfirmStep
            amount={cart.total}
            busy={submitter.isPending}
            onConfirm={() => void pay({ method: "card" })}
          />
        );
      }
      case "cashConfirm": {
        return (
          <CashConfirmStep
            amount={cart.total}
            busy={submitter.isPending}
            onConfirm={() => void pay({ method: "cash" })}
          />
        );
      }
      case "waiting": {
        return (
          <WaitingStep
            orderId={phase.orderId}
            phoneNumber={phase.phoneNumber}
            amount={cart.total}
            onSettled={settle}
          />
        );
      }
      case "failed": {
        return <FailedStep status={phase.status} onRetry={() => setPhase({ kind: "choose" })} />;
      }
      default: {
        return null;
      }
    }
  }
}

/**
 * The steps after the cart: the delivery question when a mail order is in the cart, then
 * payment, then the receipt. The drawer owns the step and what the steps pass between them, so
 * the cart step can place a free order without ever coming here.
 */
export default function StandCartCheckout({
  cart,
  customer,
  step,
  delivery,
  placed,
  submitter,
  onDelivery,
  onPlaced,
  onBack,
  onBackChange,
  onDone,
  onWaitingChange,
}: {
  cart: StandCart;
  customer: UserDetail;
  step: CheckoutStep;
  delivery: Delivery;
  placed: StandCartCheckoutState | null;
  submitter: StandCartSubmitter;
  /** The delivery step's answer; the drawer moves on to payment, or places the order. */
  onDelivery: (delivery: Delivery) => void;
  onPlaced: (state: StandCartCheckoutState) => void;
  /** "Tilbake" from the choice of payment method: the drawer knows which step came before. */
  onBack: () => void;
  /** The payment step's own way back, for the drawer's title; see PayFlow. */
  onBackChange: (back: (() => void) | null) => void;
  onDone: () => void;
  onWaitingChange: (waiting: boolean) => void;
}) {
  switch (step) {
    case "delivery": {
      return (
        <DeliveryStep
          nothingToPay={cart.total === 0}
          busy={submitter.isPending}
          onNext={onDelivery}
        />
      );
    }
    case "pay": {
      return (
        <PayFlow
          cart={cart}
          customer={customer}
          delivery={delivery}
          submitter={submitter}
          onPlaced={onPlaced}
          onBack={onBack}
          onBackChange={onBackChange}
          onWaitingChange={onWaitingChange}
        />
      );
    }
    case "done": {
      return placed === null ? null : <DoneStep state={placed} onClose={onDone} />;
    }
    default: {
      return null;
    }
  }
}
