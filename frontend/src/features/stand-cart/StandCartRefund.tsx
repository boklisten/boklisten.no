import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Button, Group, List, Loader, Stack, Text, Title } from "@mantine/core";
import { IconBuildingBank, IconSend } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import type { StandCart } from "@/features/stand-cart/useStandCart";
import { checkoutLines } from "@/features/stand-cart/useStandCartSubmit";
import type { Payment } from "@/features/stand-cart/useStandCartSubmit";
import MonitoringNotice from "@/shared/components/MonitoringNotice";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import VippsStyledButton, { VIPPS_ORANGE } from "@/shared/components/VippsStyledButton";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import { bankAccountFieldValidator } from "@/shared/components/form/fields/complex/BankAccountField";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";

const PLAN_FAILED_REASON = "Fikk ikke sjekket betalingene i Vipps";

/** The refund goes straight back on the transactions the customer paid with. */
function VippsRefundStep({
  failed,
  busy,
  onRefund,
  onChooseManual,
}: {
  /** A refund attempt came to nothing; the manual route is offered beside another try. */
  failed: boolean;
  busy: boolean;
  onRefund: () => void;
  onChooseManual: () => void;
}) {
  return (
    <Stack>
      <Stack gap="xs">
        <Title order={4}>Refunder via Vipps</Title>
        <Text size="sm">Beløpet tilbakeføres til kontoen eller kortet kunden betalte med.</Text>
      </Stack>
      {failed && (
        <ErrorAlert title="Refusjonen via Vipps gikk ikke gjennom">
          Ingenting er refundert. Du kan prøve igjen, eller be om kundens kontonummer og la
          administrator overføre beløpet.
        </ErrorAlert>
      )}
      <MonitoringNotice />
      <VippsStyledButton loading={busy} onClick={onRefund}>
        Refunder via Vipps
      </VippsStyledButton>
      {failed && (
        <Button
          variant="default"
          leftSection={<IconBuildingBank size={18} aria-hidden />}
          disabled={busy}
          onClick={onChooseManual}
        >
          Registrer manuell refusjon
        </Button>
      )}
    </Stack>
  );
}

/**
 * The money cannot go back through Vipps, so the administrator transfers it by hand. The alert
 * says why, and the form collects what the transfer needs: the account, and the employee's
 * word on why.
 */
function ManualRefundStep({
  reasons,
  busy,
  onSubmit,
}: {
  reasons: string[];
  busy: boolean;
  onSubmit: (payment: Extract<Payment, { method: "bank-transfer" }>) => void;
}) {
  const form = useAppForm({
    defaultValues: { accountNumber: "", comment: "" },
    onSubmit: ({ value }) =>
      onSubmit({
        method: "bank-transfer",
        accountNumber: value.accountNumber,
        comment: value.comment.trim() === "" ? null : value.comment.trim(),
      }),
  });
  return (
    <Stack>
      <Stack gap="xs">
        <Title order={4}>Registrer manuell refusjon</Title>
        <WarningAlert title="Automatisk refusjon er ikke tilgjengelig">
          <Stack gap={4}>
            {reasons.length > 0 && (
              <List size="sm" spacing={2}>
                {reasons.map((reason) => (
                  <List.Item key={reason}>{reason}</List.Item>
                ))}
              </List>
            )}
            <Text size="sm">
              Administrator må overføre beløpet til kundens konto manuelt. Spør etter kundens
              kontonummer.
            </Text>
          </Stack>
        </WarningAlert>
      </Stack>
      <form.AppField
        name="accountNumber"
        validators={{ onSubmit: ({ value }) => bankAccountFieldValidator(value) }}
      >
        {(field) => (
          <field.BankAccountField
            label="Kundens kontonummer"
            description="Norsk kontonummer med 11 siffer"
            data-autofocus
          />
        )}
      </form.AppField>
      <form.AppField name="comment">
        {(field) => (
          <field.TextAreaField
            label="Kommentar til administrator"
            description="Valgfritt. Si gjerne hvorfor kunden skal ha pengene tilbake."
            autosize
            minRows={2}
          />
        )}
      </form.AppField>
      <Group justify="flex-end">
        <Button
          leftSection={<IconSend size={18} aria-hidden />}
          loading={busy}
          onClick={form.handleSubmit}
        >
          Send refusjonsforespørsel
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * The "Refusjon" step: the server says whether the money can go back through Vipps, and the
 * employee either confirms that or collects the customer's account number for the administrator.
 * A Vipps attempt that fails opens the manual route without leaving the step.
 */
export default function RefundStep({
  cart,
  customer,
  busy,
  onPay,
}: {
  cart: StandCart;
  customer: UserDetail;
  busy: boolean;
  /** Resolves with whether the order went through. */
  onPay: (payment: Payment) => Promise<boolean>;
}) {
  const { client } = useApiClient();
  const [route, setRoute] = useState<"planned" | "manual">("planned");
  const [failed, setFailed] = useState(false);
  const branchId = cart.cart.branchId ?? "";
  const body = { customerId: customer.id, branchId, lines: checkoutLines(cart) };
  // A POST with the cart in the body, so it is queried by hand rather than through the route helpers
  const {
    data: plan,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["standCart", "refundPlan", body],
    queryFn: () => client.api.standCart.refundPlan({ body }),
    enabled: branchId !== "",
    retry: false,
    staleTime: 30_000,
  });

  /** A failed attempt asks the server for the plan again: it may now say the refund must be manual. */
  async function refundViaVipps() {
    setFailed(false);
    const placed = await onPay({ method: "vipps-refund" });
    if (!placed) {
      setFailed(true);
      void refetch();
    }
  }

  if (isPending) {
    return (
      <Group justify="center" gap="sm" py="md">
        <Loader size="sm" color={VIPPS_ORANGE} type="dots" />
        <Text c="dimmed">Sjekker betalingene i Vipps</Text>
      </Group>
    );
  }
  if (route === "manual" || isError || plan === null || plan.kind === "manual") {
    return (
      <ManualRefundStep
        reasons={isError ? [PLAN_FAILED_REASON] : plan?.kind === "manual" ? plan.reasons : []}
        busy={busy}
        onSubmit={(payment) => void onPay(payment)}
      />
    );
  }
  return (
    <VippsRefundStep
      failed={failed}
      busy={busy}
      onRefund={() => void refundViaVipps()}
      onChooseManual={() => setRoute("manual")}
    />
  );
}
