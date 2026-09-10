import { findOption } from "@boklisten/backend/shared/stand_cart";
import type { StandCartCheckoutState } from "@boklisten/backend/shared/stand_cart";
import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import {
  Badge,
  Drawer,
  Group,
  List,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  useMatches,
} from "@mantine/core";
import {
  IconBasket,
  IconCreditCard,
  IconReceipt,
  IconReceiptRefund,
  IconTruck,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";

import StandCartCheckout, { NextStepButton } from "@/features/stand-cart/StandCartCheckout";
import type { CheckoutStep } from "@/features/stand-cart/StandCartCheckout";
import StandCartLines from "@/features/stand-cart/StandCartLines";
import type { StandCart } from "@/features/stand-cart/useStandCart";
import useStandCartSubmit, { isPlaced } from "@/features/stand-cart/useStandCartSubmit";
import type { Delivery } from "@/features/stand-cart/useStandCartSubmit";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import MonitoringNotice from "@/shared/components/MonitoringNotice";
import useAuth from "@/shared/hooks/useAuth";
import { showErrorNotification } from "@/shared/utils/notifications";

// Above the floating cart bar (250), so the bar never sits on top of the cart it opens; the
// drawer's own dropdowns (300) and confirmations (350) still outrank it.
const DRAWER_Z_INDEX = 260;

type Step = "cart" | CheckoutStep;

/** Where the employee is, as the drawer's title: the step's name with its icon. */
const STEP_TITLES: Record<Step | "refund", { label: string; icon: typeof IconBasket }> = {
  cart: { label: "Handlekurv", icon: IconBasket },
  delivery: { label: "Levering", icon: IconTruck },
  pay: { label: "Betaling", icon: IconCreditCard },
  refund: { label: "Refusjon", icon: IconReceiptRefund },
  done: { label: "Kvittering", icon: IconReceipt },
};

function StepTitle({ step, refund }: { step: Step; refund: boolean }) {
  const { label, icon: Icon } = STEP_TITLES[step === "pay" && refund ? "refund" : step];
  return (
    <Group gap="xs" wrap="nowrap">
      <ThemeIcon variant="light" size="md" radius="xl">
        <Icon size={18} aria-hidden />
      </ThemeIcon>
      <Text fw={600}>{label}</Text>
    </Group>
  );
}

/**
 * One notice for the whole cart instead of one per line: which books are outside the rules and
 * why, so the employee sees at a glance what the administrator will be told.
 */
function MonitoredSummary({ cart }: { cart: StandCart }) {
  const monitored = cart.lines.flatMap(({ line, choice }) => {
    const option = findOption(line, choice);
    return option?.monitored === true
      ? [{ key: line.key, title: line.title, reason: option.reason ?? "Dette er utenfor reglene" }]
      : [];
  });
  if (monitored.length === 0) {
    return null;
  }
  return (
    <MonitoringNotice
      actions={
        <List size="sm" mt={4}>
          {monitored.map((entry) => (
            <List.Item key={entry.key}>
              <Text span fw={600}>
                {entry.title}
              </Text>
              : {entry.reason}
            </List.Item>
          ))}
        </List>
      }
    />
  );
}

/**
 * The one thing only an administrator may decide from the cart: whether the customer gets the
 * receipt by e-mail. Set apart in a dashed card with the administrator badge, so it reads as a
 * privileged control rather than part of the ordinary flow, without a sentence saying so.
 */
function AdminReceiptCard({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return null;
  }
  return (
    // Pushed to the foot of the drawer, however short the cart above it is
    <Paper withBorder radius="md" p="sm" mt="auto" style={{ borderStyle: "dashed" }}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Switch
          label="Send kvittering på e-post"
          checked={value}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        {/* The permission badge's colour, in a word short enough to share a phone's width */}
        <Badge variant="filled" color="red" size="xs" style={{ flexShrink: 0 }}>
          Admin
        </Badge>
      </Group>
    </Paper>
  );
}

/** Where the cart's button leads: delivery first for a mail order, else payment, else straight to an order. */
function nextStep(cart: StandCart): "delivery" | "pay" | "confirm" {
  if (cart.hasBringDelivery) {
    return "delivery";
  }
  return cart.total === 0 ? "confirm" : "pay";
}

function CartBody({
  cart,
  notifyByEmail,
  busy,
  onNotifyByEmailChange,
  onNext,
}: {
  cart: StandCart;
  notifyByEmail: boolean;
  /** The order is being placed from here, with nothing to pay. */
  busy: boolean;
  onNotifyByEmailChange: (value: boolean) => void;
  onNext: () => void;
}) {
  const [switchingBranch, setSwitchingBranch] = useState(false);
  const narrow = useMatches({ base: true, sm: false });
  const blocked = cart.problems.length > 0 || cart.cart.branchId === null;

  async function switchBranch(branchId: string | null) {
    if (branchId === null || branchId === cart.cart.branchId) {
      return;
    }
    setSwitchingBranch(true);
    try {
      await cart.setBranch(branchId);
    } finally {
      setSwitchingBranch(false);
    }
  }

  if (cart.isEmpty) {
    return (
      <InfoAlert>
        Handlekurven er tom. Skann en bok, eller legg bøker til fra listene over kundens
        bestillinger og bøker.
      </InfoAlert>
    );
  }

  return (
    <Stack gap="md" flex={1}>
      <Select
        label="Filial"
        description="Bøkene deles ut og registreres på denne filialen"
        size="md"
        searchable={!narrow}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        allowDeselect={false}
        nothingFoundMessage="Fant ingen filial"
        data={cart.branches.map((branch) => ({ value: branch.id, label: branch.name }))}
        value={cart.cart.branchId}
        disabled={switchingBranch}
        onChange={(branchId) => void switchBranch(branchId)}
        // Mantine drawers sit at z-index 200, so the dropdown must be lifted with it
        comboboxProps={{ zIndex: 300 }}
      />

      <StandCartLines cart={cart} />

      <MonitoredSummary cart={cart} />

      <NextStepButton to={nextStep(cart)} disabled={blocked} loading={busy} onClick={onNext} />
      <AdminReceiptCard value={notifyByEmail} onChange={onNotifyByEmailChange} />
    </Stack>
  );
}

/**
 * The cart itself: the branch it works for, the lines with their choices, and the checkout that
 * takes over the same drawer, with the title saying which step the employee is on. A bottom
 * sheet on phones, a right-hand panel from tablet up.
 */
export default function StandCartDrawer({
  cart,
  customer,
  opened,
  onClose,
}: {
  cart: StandCart;
  customer: UserDetail;
  opened: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("cart");
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [delivery, setDelivery] = useState<Delivery>(null);
  const [placed, setPlaced] = useState<StandCartCheckoutState | null>(null);
  // While a Vipps request is out, the only way out is "Avbryt forespørsel", so the order never dangles
  const [waiting, setWaiting] = useState(false);
  const narrow = useMatches({ base: true, sm: false });
  const submitter = useStandCartSubmit({
    cart,
    customer,
    notifyByEmail,
    onCartChanged: () => setStep("cart"),
  });

  useEffect(() => {
    if (opened) {
      setStep("cart");
      setNotifyByEmail(true);
      setDelivery(null);
      void cart.refresh();
    }
    // Only when the drawer opens: the lines are re-priced once so stale ones show as problems
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  function finish(state: StandCartCheckoutState) {
    setPlaced(state);
    setStep("done");
  }

  /** Nothing to pay: the cart becomes an order at once, with no payment step in between. */
  async function confirm(chosenDelivery: Delivery) {
    const state = await submitter.submit(null, chosenDelivery);
    if (state === null) {
      return;
    }
    submitter.settle(state);
    if (isPlaced(state)) {
      finish(state);
    } else {
      showErrorNotification("Klarte ikke fullføre handlekurven");
    }
  }

  function next() {
    const to = nextStep(cart);
    if (to === "confirm") {
      void confirm(null);
    } else {
      setStep(to);
    }
  }

  function answerDelivery(chosen: Delivery) {
    setDelivery(chosen);
    if (cart.total === 0) {
      void confirm(chosen);
    } else {
      setStep("pay");
    }
  }

  /** The step before the current one, for "Tilbake". */
  function back() {
    setStep(step === "pay" && cart.hasBringDelivery ? "delivery" : "cart");
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<StepTitle step={step} refund={cart.total < 0} />}
      position={narrow ? "bottom" : "right"}
      // Wide enough on a desk for the table to keep a title on one line beside the actions
      size={narrow ? "92%" : "xl"}
      zIndex={DRAWER_Z_INDEX}
      closeOnClickOutside={!waiting}
      closeOnEscape={!waiting}
      withCloseButton={!waiting}
      trapFocus={false}
      // The body fills the drawer, so the cart step can pin its admin card to the bottom
      styles={{
        content: { display: "flex", flexDirection: "column" },
        body: { flex: 1, display: "flex", flexDirection: "column" },
      }}
    >
      <Stack gap="md" pb="md" flex={1}>
        {step === "cart" ? (
          <CartBody
            cart={cart}
            notifyByEmail={notifyByEmail}
            busy={submitter.isPending}
            onNotifyByEmailChange={setNotifyByEmail}
            onNext={next}
          />
        ) : (
          <StandCartCheckout
            cart={cart}
            customer={customer}
            step={step}
            delivery={delivery}
            placed={placed}
            submitter={submitter}
            onDelivery={answerDelivery}
            onPlaced={finish}
            onBack={back}
            onDone={onClose}
            onWaitingChange={setWaiting}
          />
        )}
      </Stack>
    </Drawer>
  );
}
