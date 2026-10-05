import type { Branch, BranchPeriods } from "@boklisten/backend/shared/branch";
import type { InheritedBranchField } from "@boklisten/backend/shared/branch-inheritance";
import { Button, Card, Fieldset, Group, Stack } from "@mantine/core";
import { modals } from "@mantine/modals";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { Activity } from "react";

import InheritedFieldCard from "@/features/branches/inheritance/InheritedFieldCard";
import { INHERITED_FIELDS, onOffLabel } from "@/features/branches/inheritance/inheritedFields";
import { ToneSwitch } from "@/features/branches/inheritance/tone";
import useInheritedField from "@/features/branches/inheritance/useInheritedField";
import { commitValue, useAppForm } from "@/shared/hooks/form";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { api, apiClient } from "@/shared/utils/apiClient";

type SwitchName = Extract<
  InheritedBranchField,
  "deliveryAtBranch" | "deliveryByMail" | "responsibleForDelivery" | "paymentResponsible"
>;
type PercentageName = Extract<InheritedBranchField, "buyoutPercentage" | "sellPercentage">;

/**
 * The PATCH body is the form's values as they are; the inherited settings are the branch's
 * overrides, `null` where it inherits.
 */
type PaymentValues = Pick<Branch["overrides"], SwitchName | PercentageName> & BranchPeriods;

function valuesOf(branch: Branch): PaymentValues {
  return {
    deliveryAtBranch: branch.overrides.deliveryAtBranch,
    deliveryByMail: branch.overrides.deliveryByMail,
    responsibleForDelivery: branch.overrides.responsibleForDelivery,
    paymentResponsible: branch.overrides.paymentResponsible,
    buyoutPercentage: branch.overrides.buyoutPercentage,
    sellPercentage: branch.overrides.sellPercentage,
    rentPeriods: branch.rentPeriods,
    partlyPaymentPeriods: branch.partlyPaymentPeriods,
    extendPeriods: branch.extendPeriods,
  };
}

const PERIOD_TYPE_OPTIONS = [
  { label: "semester", value: "semester" },
  { label: "år", value: "year" },
];

/** Every control auto-saves; the six inherited settings sit in the shared inheritance card. */
export default function BranchPaymentSettings({ existingBranch }: { existingBranch: Branch }) {
  const branch = existingBranch;
  const form = useAppForm(
    useAutoSave({
      defaultValues: valuesOf(branch),
      persist: (values) =>
        apiClient.api.branches.update({ params: { branchId: branch.id }, body: values }),
      invalidates: [api.branches.index.pathKey()],
    }),
  );

  function switchCard(
    name: SwitchName,
    field: {
      state: { value: boolean | null };
      handleChange: (value: boolean | null) => void;
      handleBlur: () => void;
    },
  ) {
    return (
      <InheritedFieldCard
        branchId={branch.id}
        field={name}
        tab="payment"
        value={field.state.value}
        onChange={(value) => commitValue(field, value)}
      >
        {(value, setValue, tone) => (
          <ToneSwitch
            checked={value}
            onChange={setValue}
            tone={tone}
            label={onOffLabel(value)}
            ariaLabel={INHERITED_FIELDS[name].label}
          />
        )}
      </InheritedFieldCard>
    );
  }

  function percentageCard(
    name: PercentageName,
    field: {
      state: { value: number | null };
      handleChange: (value: number | null) => void;
      handleBlur: () => void;
    },
  ) {
    return (
      <InheritedFieldCard
        branchId={branch.id}
        field={name}
        tab="payment"
        value={field.state.value}
        onChange={(value) => commitValue(field, value)}
      >
        {(value, setValue, tone) =>
          // The same whole-percent field as in the descendant tree, one size up.
          INHERITED_FIELDS[name].renderEditor(value, setValue, {
            label: INHERITED_FIELDS[name].label,
            tone,
            size: "sm",
          })
        }
      </InheritedFieldCard>
    );
  }

  return (
    <Stack gap="lg">
      <form.AppField name="deliveryAtBranch">
        {(field) => switchCard("deliveryAtBranch", field)}
      </form.AppField>
      <form.AppField name="deliveryByMail">
        {(field) => switchCard("deliveryByMail", field)}
      </form.AppField>
      <form.Subscribe selector={(state) => state.values.deliveryByMail}>
        {(override) => (
          <DeliveryByMailOnly branchId={branch.id} override={override}>
            <form.AppField name="responsibleForDelivery">
              {(field) => switchCard("responsibleForDelivery", field)}
            </form.AppField>
          </DeliveryByMailOnly>
        )}
      </form.Subscribe>
      <form.AppField name="paymentResponsible">
        {(field) => switchCard("paymentResponsible", field)}
      </form.AppField>
      <form.AppField name="buyoutPercentage">
        {(field) => percentageCard("buyoutPercentage", field)}
      </form.AppField>
      <form.AppField name="sellPercentage">
        {(field) => percentageCard("sellPercentage", field)}
      </form.AppField>
      <Fieldset legend="Låneperioder">
        <Stack align="center">
          <form.AppField name="rentPeriods" mode="array">
            {(field) => (
              <>
                {field.state.value.map((_, i) => (
                  <PeriodCard
                    key={`rent-${i}`}
                    onRemove={() => commitValue(field, field.state.value.toSpliced(i, 1))}
                  >
                    <form.AppField name={`rentPeriods[${i}].type`}>
                      {(subField) => (
                        <subField.SelectField label="Type" data={PERIOD_TYPE_OPTIONS} />
                      )}
                    </form.AppField>
                    <form.AppField name={`rentPeriods[${i}].date`}>
                      {(subField) => (
                        <subField.DeadlinePickerField clearable={false} label="Frist" />
                      )}
                    </form.AppField>
                    <form.AppField name={`rentPeriods[${i}].maxNumberOfPeriods`}>
                      {(subField) => (
                        <subField.NumberField
                          label="Grense"
                          allowNegative={false}
                          allowDecimal={false}
                        />
                      )}
                    </form.AppField>
                    <form.AppField name={`rentPeriods[${i}].percentage`}>
                      {(subField) => <subField.PercentageField label="Prosent" />}
                    </form.AppField>
                  </PeriodCard>
                ))}
                <Button
                  onClick={() =>
                    commitValue(field, [
                      ...field.state.value,
                      {
                        type: "semester",
                        maxNumberOfPeriods: 1,
                        percentage: 1,
                        date: dayjs().format("YYYY-MM-DD"),
                      },
                    ])
                  }
                >
                  Legg til
                </Button>
              </>
            )}
          </form.AppField>
        </Stack>
      </Fieldset>
      <Fieldset legend="Delbetalingsperioder">
        <Stack align="center">
          <form.AppField name="partlyPaymentPeriods" mode="array">
            {(field) => (
              <>
                {field.state.value.map((_, i) => (
                  <PeriodCard
                    key={`partlyPayment-${i}`}
                    onRemove={() => commitValue(field, field.state.value.toSpliced(i, 1))}
                  >
                    <Group w="100%">
                      <form.AppField name={`partlyPaymentPeriods[${i}].type`}>
                        {(subField) => (
                          <subField.SelectField label="Type" data={PERIOD_TYPE_OPTIONS} />
                        )}
                      </form.AppField>
                      <form.AppField name={`partlyPaymentPeriods[${i}].date`}>
                        {(subField) => (
                          <subField.DeadlinePickerField clearable={false} label="Frist" />
                        )}
                      </form.AppField>
                    </Group>
                    <Group>
                      <form.AppField name={`partlyPaymentPeriods[${i}].percentageUpFront`}>
                        {(subField) => <subField.PercentageField label="Første betaling" />}
                      </form.AppField>
                      <form.AppField name={`partlyPaymentPeriods[${i}].percentageBuyout`}>
                        {(subField) => <subField.PercentageField label="Utkjøpsprosent" />}
                      </form.AppField>
                    </Group>
                  </PeriodCard>
                ))}
                <Button
                  onClick={() =>
                    commitValue(field, [
                      ...field.state.value,
                      {
                        type: "semester",
                        percentageBuyout: 1,
                        percentageUpFront: 1,
                        date: dayjs().format("YYYY-MM-DD"),
                      },
                    ])
                  }
                >
                  Legg til
                </Button>
              </>
            )}
          </form.AppField>
        </Stack>
      </Fieldset>
      <Fieldset legend="Forlengingsperioder">
        <Stack align="center">
          <form.AppField name="extendPeriods" mode="array">
            {(field) => (
              <>
                {field.state.value.map((_, i) => (
                  <PeriodCard
                    key={`extend-${i}`}
                    onRemove={() => commitValue(field, field.state.value.toSpliced(i, 1))}
                  >
                    <form.AppField name={`extendPeriods[${i}].type`}>
                      {(subField) => (
                        <subField.SelectField label="Type" data={PERIOD_TYPE_OPTIONS} />
                      )}
                    </form.AppField>
                    <form.AppField name={`extendPeriods[${i}].date`}>
                      {(subField) => (
                        <subField.DeadlinePickerField clearable={false} label="Dato" />
                      )}
                    </form.AppField>
                    <form.AppField name={`extendPeriods[${i}].maxNumberOfPeriods`}>
                      {(subField) => (
                        <subField.NumberField
                          label="Grense"
                          allowNegative={false}
                          allowDecimal={false}
                        />
                      )}
                    </form.AppField>
                    <form.AppField name={`extendPeriods[${i}].price`}>
                      {(subField) => <subField.CurrencyField label="Pris" />}
                    </form.AppField>
                  </PeriodCard>
                ))}
                <Button
                  onClick={() =>
                    commitValue(field, [
                      ...field.state.value,
                      {
                        type: "semester",
                        maxNumberOfPeriods: 1,
                        price: 0,
                        percentage: null,
                        date: dayjs().format("YYYY-MM-DD"),
                      },
                    ])
                  }
                >
                  Legg til
                </Button>
              </>
            )}
          </form.AppField>
        </Stack>
      </Fieldset>
      <form.AppForm>
        <form.ErrorSummary autoSave />
      </form.AppForm>
    </Stack>
  );
}

/** Shows its children only while the branch delivers by mail, inherited or not. */
function DeliveryByMailOnly({
  branchId,
  override,
  children,
}: {
  branchId: string;
  override: boolean | null;
  children: ReactNode;
}) {
  const deliveryByMail = useInheritedField(branchId, "deliveryByMail", override)?.value ?? false;
  return <Activity mode={deliveryByMail ? "visible" : "hidden"}>{children}</Activity>;
}

/** One period with its remove button; removing saves at once, so it asks first. */
function PeriodCard({ onRemove, children }: { onRemove: () => void; children: ReactNode }) {
  return (
    <Card withBorder w="100%">
      <Stack>
        {children}
        <Group>
          <Button
            color="red"
            onClick={() =>
              modals.openConfirmModal({
                title: "Fjern perioden",
                children: "Perioden fjernes.",
                labels: { confirm: "Bekreft", cancel: "Avbryt" },
                confirmProps: { color: "red" },
                onConfirm: onRemove,
              })
            }
          >
            Fjern
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
