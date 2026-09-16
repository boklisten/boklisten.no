import type { Branch } from "@boklisten/backend/shared/branch";
import { Button, Card, Fieldset, Group, Stack } from "@mantine/core";
import dayjs from "dayjs";
import { Activity } from "react";

import useUpdateBranchMutation from "@/features/branches/useUpdateBranchMutation";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { useAppForm } from "@/shared/hooks/form";

export default function BranchPaymentSettings({ existingBranch }: { existingBranch: Branch }) {
  const updateBranchMutation = useUpdateBranchMutation();

  const form = useAppForm({
    defaultValues: {
      deliveryAtBranch: existingBranch.deliveryAtBranch,
      deliveryByMail: existingBranch.deliveryByMail,
      paymentResponsible: existingBranch.paymentResponsible,
      responsibleForDelivery: existingBranch.responsibleForDelivery,
      buyoutPercentage: existingBranch.buyoutPercentage,
      sellPercentage: existingBranch.sellPercentage,
      partlyPaymentPeriods: existingBranch.partlyPaymentPeriods.map((partlyPaymentPeriod) => ({
        ...partlyPaymentPeriod,
        date: dayjs(partlyPaymentPeriod.date).format("YYYY-MM-DD"),
      })),
      rentPeriods: existingBranch.rentPeriods.map((rentPeriod) => ({
        ...rentPeriod,
        date: dayjs(rentPeriod.date).format("YYYY-MM-DD"),
      })),
      extendPeriods: existingBranch.extendPeriods.map((extendPeriod) => ({
        ...extendPeriod,
        date: dayjs(extendPeriod.date).format("YYYY-MM-DD"),
      })),
    },
    onSubmit: ({ value }) =>
      updateBranchMutation.mutate({ params: { branchId: existingBranch.id }, body: value }),
  });

  return (
    <Stack>
      <form.AppField name="deliveryAtBranch">
        {(field) => <field.SwitchField label="Utlevering på filial" />}
      </form.AppField>
      <form.AppField name="deliveryByMail">
        {(field) => <field.SwitchField label="Levering per post" />}
      </form.AppField>
      <form.Subscribe selector={(state) => state.values.deliveryByMail}>
        {(value) => (
          <Activity mode={value ? "visible" : "hidden"}>
            <form.AppField name="responsibleForDelivery">
              {(field) => <field.SwitchField label="Gratis postlevering" />}
            </form.AppField>
          </Activity>
        )}
      </form.Subscribe>
      <form.AppField name="paymentResponsible">
        {(field) => <field.SwitchField label="Ansvarlig for betaling" />}
      </form.AppField>
      <form.AppField name="buyoutPercentage">
        {(field) => <field.PercentageField label="Utkjøpsprosent" />}
      </form.AppField>
      <form.AppField name="sellPercentage">
        {(field) => <field.PercentageField label="Innkjøpsprosent" />}
      </form.AppField>
      <Activity mode={!existingBranch.type ? "visible" : "hidden"}>
        <Fieldset legend="Perioder">
          <InfoAlert title="Ingen filialtype valgt">
            Du må velge filialtype for å kunne legge inn låne- eller delbetalingsperioder
          </InfoAlert>
        </Fieldset>
      </Activity>
      <Activity mode={existingBranch.type === "VGS" ? "visible" : "hidden"}>
        <Fieldset legend="Låneperioder">
          <Stack align="center">
            <form.AppField name="rentPeriods" mode="array">
              {(field) => (
                <>
                  {field.state.value.map((_, i) => (
                    <Card key={`rent-${i}`} withBorder w="100%">
                      <Stack>
                        <form.AppField name={`rentPeriods[${i}].type`}>
                          {(subField) => (
                            <subField.SelectField
                              label="Type"
                              data={[
                                {
                                  label: "semester",
                                  value: "semester",
                                },
                                { label: "år", value: "year" },
                              ]}
                            />
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
                        <Group>
                          <Button
                            bg="red"
                            onClick={() => field.setValue(field.state.value.toSpliced(i, 1))}
                          >
                            Fjern
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                  <Button
                    onClick={() =>
                      field.setValue([
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
      </Activity>
      <Activity mode={existingBranch.type === "privatist" ? "visible" : "hidden"}>
        <Fieldset legend="Delbetalingsperioder">
          <Stack align="center">
            <form.AppField name="partlyPaymentPeriods" mode="array">
              {(field) => (
                <>
                  {field.state.value.map((_, i) => (
                    <Card key={`partlyPayment-${i}`} withBorder w="100%">
                      <Stack>
                        <Group w="100%">
                          <form.AppField name={`partlyPaymentPeriods[${i}].type`}>
                            {(subField) => (
                              <subField.SelectField
                                label="Type"
                                data={[
                                  {
                                    label: "semester",
                                    value: "semester",
                                  },
                                  { label: "år", value: "year" },
                                ]}
                              />
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
                          <form.AppField name={`partlyPaymentPeriods[${i}].percentageUpFrontUsed`}>
                            {(subField) => (
                              <subField.PercentageField label="Første betaling (brukt)" />
                            )}
                          </form.AppField>
                        </Group>
                        <Group>
                          <form.AppField name={`partlyPaymentPeriods[${i}].percentageBuyout`}>
                            {(subField) => <subField.PercentageField label="Utkjøpsprosent" />}
                          </form.AppField>
                          <form.AppField name={`partlyPaymentPeriods[${i}].percentageBuyoutUsed`}>
                            {(subField) => (
                              <subField.PercentageField label="Utkjøpsprosent (brukt)" />
                            )}
                          </form.AppField>
                        </Group>
                        <Group>
                          <Button
                            bg="red"
                            onClick={() => field.setValue(field.state.value.toSpliced(i, 1))}
                          >
                            Fjern
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                  <Button
                    onClick={() =>
                      field.setValue([
                        ...field.state.value,
                        {
                          type: "semester",
                          percentageBuyout: 1,
                          percentageBuyoutUsed: 1,
                          percentageUpFront: 1,
                          percentageUpFrontUsed: 1,
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
      </Activity>
      <Fieldset legend="Forlengingsperioder">
        <Stack align="center">
          <form.AppField name="extendPeriods" mode="array">
            {(field) => (
              <>
                {field.state.value.map((_, i) => (
                  <Card key={`extend-${i}`} withBorder w="100%">
                    <Stack>
                      <form.AppField name={`extendPeriods[${i}].type`}>
                        {(subField) => (
                          <subField.SelectField
                            label="Type"
                            data={[
                              { label: "semester", value: "semester" },
                              { label: "år", value: "year" },
                            ]}
                          />
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
                      <Group>
                        <Button
                          bg="red"
                          onClick={() => field.setValue(field.state.value.toSpliced(i, 1))}
                        >
                          Fjern
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                ))}
                <Button
                  onClick={() =>
                    field.setValue([
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
        <form.ErrorSummary />
      </form.AppForm>
      <Button color="green" onClick={form.handleSubmit} loading={updateBranchMutation.isPending}>
        Lagre
      </Button>
    </Stack>
  );
}
