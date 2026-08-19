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
      id: existingBranch.id,
      deliveryMethods: {
        branch: existingBranch.deliveryMethods?.branch ?? false,
        byMail: existingBranch.deliveryMethods?.byMail ?? false,
      },
      paymentInfo: {
        responsible: existingBranch.paymentInfo?.responsible ?? false,
        responsibleForDelivery: existingBranch.paymentInfo?.responsibleForDelivery ?? false,
        partlyPaymentPeriods:
          existingBranch.paymentInfo?.partlyPaymentPeriods?.map((partlyPaymentPeriod) => ({
            ...partlyPaymentPeriod,
            date: dayjs(partlyPaymentPeriod.date).format("YYYY-MM-DD"),
          })) ?? [],
        rentPeriods:
          existingBranch.paymentInfo?.rentPeriods?.map((rentPeriod) => ({
            ...rentPeriod,
            date: dayjs(rentPeriod.date).format("YYYY-MM-DD"),
          })) ?? [],
        extendPeriods:
          existingBranch.paymentInfo?.extendPeriods?.map((extendPeriod) => ({
            ...extendPeriod,
            date: dayjs(extendPeriod.date).format("YYYY-MM-DD"),
          })) ?? [],
        buyout: {
          percentage: existingBranch.paymentInfo?.buyout?.percentage ?? 1,
        },
        sell: {
          percentage: existingBranch.paymentInfo?.sell?.percentage ?? 1,
        },
      },
    },
    onSubmit: ({ value }) => updateBranchMutation.mutate({ body: value }),
  });

  return (
    <Stack>
      <form.AppField name={"deliveryMethods.branch"}>
        {(field) => <field.SwitchField label={"Utlevering på filial"} />}
      </form.AppField>
      <form.AppField name={"deliveryMethods.byMail"}>
        {(field) => <field.SwitchField label={"Levering per post"} />}
      </form.AppField>
      <form.Subscribe selector={(state) => state.values.deliveryMethods?.byMail}>
        {(value) => (
          <Activity mode={value ? "visible" : "hidden"}>
            <form.AppField name={"paymentInfo.responsibleForDelivery"}>
              {(field) => <field.SwitchField label={"Gratis postlevering"} />}
            </form.AppField>
          </Activity>
        )}
      </form.Subscribe>
      <form.AppField name={"paymentInfo.responsible"}>
        {(field) => <field.SwitchField label={"Ansvarlig for betaling"} />}
      </form.AppField>
      <form.AppField name={"paymentInfo.buyout.percentage"}>
        {(field) => <field.PercentageField label={"Utkjøpsprosent"} />}
      </form.AppField>
      <form.AppField name={"paymentInfo.sell.percentage"}>
        {(field) => <field.PercentageField label={"Innkjøpsprosent"} />}
      </form.AppField>
      <Activity mode={!existingBranch.type ? "visible" : "hidden"}>
        <Fieldset legend={"Perioder"}>
          <InfoAlert title={"Ingen filialtype valgt"}>
            Du må velge filialtype for å kunne legge inn låne- eller delbetalingsperioder
          </InfoAlert>
        </Fieldset>
      </Activity>
      <Activity mode={existingBranch.type === "VGS" ? "visible" : "hidden"}>
        <Fieldset legend={"Låneperioder"}>
          <Stack align={"center"}>
            <form.AppField name="paymentInfo.rentPeriods" mode="array">
              {(field) => (
                <>
                  {field.state.value.map((_, i) => (
                    <Card key={`rent-${i}`} withBorder w={"100%"}>
                      <Stack>
                        <form.AppField name={`paymentInfo.rentPeriods[${i}].type`}>
                          {(subField) => (
                            <subField.SelectField
                              label={"Type"}
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
                        <form.AppField name={`paymentInfo.rentPeriods[${i}].date`}>
                          {(subField) => (
                            <subField.DeadlinePickerField clearable={false} label={"Frist"} />
                          )}
                        </form.AppField>
                        <form.AppField name={`paymentInfo.rentPeriods[${i}].maxNumberOfPeriods`}>
                          {(subField) => (
                            <subField.NumberField
                              label={"Grense"}
                              allowNegative={false}
                              allowDecimal={false}
                            />
                          )}
                        </form.AppField>
                        <form.AppField name={`paymentInfo.rentPeriods[${i}].percentage`}>
                          {(subField) => <subField.PercentageField label={"Prosent"} />}
                        </form.AppField>
                        <Group>
                          <Button
                            bg={"red"}
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
                      field.setValue(
                        field.state.value.concat([
                          {
                            type: "semester",
                            maxNumberOfPeriods: 1,
                            percentage: 1,
                            date: dayjs().format("YYYY-MM-DD"),
                          },
                        ]),
                      )
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
        <Fieldset legend={"Delbetalingsperioder"}>
          <Stack align={"center"}>
            <form.AppField name="paymentInfo.partlyPaymentPeriods" mode="array">
              {(field) => (
                <>
                  {field.state.value.map((_, i) => (
                    <Card key={`partlyPayment-${i}`} withBorder w={"100%"}>
                      <Stack>
                        <Group w={"100%"}>
                          <form.AppField name={`paymentInfo.partlyPaymentPeriods[${i}].type`}>
                            {(subField) => (
                              <subField.SelectField
                                label={"Type"}
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
                          <form.AppField name={`paymentInfo.partlyPaymentPeriods[${i}].date`}>
                            {(subField) => (
                              <subField.DeadlinePickerField clearable={false} label={"Frist"} />
                            )}
                          </form.AppField>
                        </Group>
                        <Group>
                          <form.AppField
                            name={`paymentInfo.partlyPaymentPeriods[${i}].percentageUpFront`}
                          >
                            {(subField) => <subField.PercentageField label={"Første betaling"} />}
                          </form.AppField>
                          <form.AppField
                            name={`paymentInfo.partlyPaymentPeriods[${i}].percentageUpFrontUsed`}
                          >
                            {(subField) => (
                              <subField.PercentageField label={"Første betaling (brukt)"} />
                            )}
                          </form.AppField>
                        </Group>
                        <Group>
                          <form.AppField
                            name={`paymentInfo.partlyPaymentPeriods[${i}].percentageBuyout`}
                          >
                            {(subField) => <subField.PercentageField label={"Utkjøpsprosent"} />}
                          </form.AppField>
                          <form.AppField
                            name={`paymentInfo.partlyPaymentPeriods[${i}].percentageBuyoutUsed`}
                          >
                            {(subField) => (
                              <subField.PercentageField label={"Utkjøpsprosent (brukt)"} />
                            )}
                          </form.AppField>
                        </Group>
                        <Group>
                          <Button
                            bg={"red"}
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
                      field.setValue(
                        field.state.value.concat([
                          {
                            type: "semester",
                            percentageBuyout: 1,
                            percentageBuyoutUsed: 1,
                            percentageUpFront: 1,
                            percentageUpFrontUsed: 1,
                            date: dayjs().format("YYYY-MM-DD"),
                          },
                        ]),
                      )
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
      <Fieldset legend={"Forlengingsperioder"}>
        <Stack align={"center"}>
          <form.AppField name="paymentInfo.extendPeriods" mode="array">
            {(field) => (
              <>
                {field.state.value.map((_, i) => (
                  <Card key={`extend-${i}`} withBorder w={"100%"}>
                    <Stack>
                      <form.AppField name={`paymentInfo.extendPeriods[${i}].type`}>
                        {(subField) => (
                          <subField.SelectField
                            label={"Type"}
                            data={[
                              { label: "semester", value: "semester" },
                              { label: "år", value: "year" },
                            ]}
                          />
                        )}
                      </form.AppField>
                      <form.AppField name={`paymentInfo.extendPeriods[${i}].date`}>
                        {(subField) => (
                          <subField.DeadlinePickerField clearable={false} label={"Dato"} />
                        )}
                      </form.AppField>
                      <form.AppField name={`paymentInfo.extendPeriods[${i}].maxNumberOfPeriods`}>
                        {(subField) => (
                          <subField.NumberField
                            label={"Grense"}
                            allowNegative={false}
                            allowDecimal={false}
                          />
                        )}
                      </form.AppField>
                      <form.AppField name={`paymentInfo.extendPeriods[${i}].price`}>
                        {(subField) => <subField.CurrencyField label={"Pris"} />}
                      </form.AppField>
                      <Group>
                        <Button
                          bg={"red"}
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
                    field.setValue(
                      field.state.value.concat([
                        {
                          type: "semester",
                          maxNumberOfPeriods: 1,
                          price: 0,
                          date: dayjs().format("YYYY-MM-DD"),
                        },
                      ]),
                    )
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
      <Button color={"green"} onClick={form.handleSubmit} loading={updateBranchMutation.isPending}>
        Lagre
      </Button>
    </Stack>
  );
}
