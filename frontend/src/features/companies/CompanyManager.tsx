import type { Company } from "@boklisten/backend/shared/company";
import { Box, Button, Card, Divider, Group, Skeleton, Stack, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconBuildings, IconMapPin, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity } from "react";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { addressFieldValidator } from "@/shared/components/form/fields/complex/AddressField";
import { emailFieldValidator } from "@/shared/components/form/fields/complex/EmailField";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { postalCodeFieldValidator } from "@/shared/components/form/fields/complex/PostalCodeField";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

function CompanyCard({ company }: { company: Company }) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const deleteCompanyMutation = useMutation(
    api.companies.deleteCompany.mutationOptions({
      onSuccess: () => showSuccessNotification(`${company.name} ble slettet!`),
      onError: () => showErrorNotification(`Klarte ikke slette ${company.name}`),
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: api.companies.getCompanies.pathKey() }),
    }),
  );
  return (
    <Card withBorder>
      <Group justify="space-between">
        <Title order={3}>{company.name}</Title>
        <Button
          loading={deleteCompanyMutation.isPending}
          bg="red"
          onClick={() =>
            modals.openConfirmModal({
              title: `Bekreft sletting av ${company.name}`,
              children: "Dette kan ikke angres.",
              labels: {
                cancel: "Avbryt",
                confirm: "Slett",
              },
              confirmProps: {
                bg: "red",
              },
              onConfirm: () => deleteCompanyMutation.mutate({ params: { companyId: company.id } }),
            })
          }
        >
          Slett
        </Button>
      </Group>
      <Group>
        <Group gap={5}>
          <IconBuildings />
          <Text>{company.organizationNumber}</Text>
        </Group>
        <Group gap={5}>
          <IconMapPin />
          <Text>{company.contactInfo.address}</Text>
        </Group>
      </Group>
    </Card>
  );
}

function CreateCompanyForm({ onSuccess }: { onSuccess: () => void }) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();
  const addCompanyMutation = useMutation(
    api.companies.addCompany.mutationOptions({
      onError: () => showErrorNotification("Klarte ikke opprette selskap!"),
      onSuccess: () => {
        showSuccessNotification(`${form.state.values.name} ble opprettet!`);
        onSuccess();
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: api.companies.getCompanies.pathKey() }),
    }),
  );
  const form = useAppForm({
    defaultValues: {
      name: "",
      organizationNumber: "",
      customerNumber: "",
      contactInfo: {
        phone: "",
        email: "",
        address: "",
        postal: {
          code: "",
          city: "",
        },
      },
    },
    onSubmit: (data) => addCompanyMutation.mutate({ body: data.value }),
  });
  return (
    <Stack>
      <Title order={3}>Opprett selskap</Title>
      <form.AppField
        name="name"
        validators={{
          onBlur: ({ value }) => (!value ? "Du må fylle inn navn på selskap" : null),
        }}
      >
        {(field) => <field.TextField label="Navn på selskap" required placeholder="Lom kommune" />}
      </form.AppField>
      <form.AppField
        name="organizationNumber"
        validators={{
          onBlur: ({ value }) => (!value ? "Du må fylle inn organisasjonsnummer" : null),
        }}
      >
        {(field) => (
          <field.TextField label="Organisasjonsnummer" required placeholder="912047385" />
        )}
      </form.AppField>
      <form.AppField
        name="customerNumber"
        validators={{
          onBlur: ({ value }) => (!value ? "Du må fylle inn kundenummer" : null),
        }}
      >
        {(field) => <field.TextField label="Kundenummer" required placeholder="123" />}
      </form.AppField>
      <form.AppField
        name="contactInfo.phone"
        validators={{
          onBlur: ({ value }) => phoneNumberFieldValidator(value, "administrate"),
        }}
      >
        {(field) => <field.PhoneNumberField />}
      </form.AppField>
      <form.AppField
        name="contactInfo.email"
        validators={{
          onBlur: ({ value }) => emailFieldValidator(value, "administrate"),
        }}
      >
        {(field) => <field.EmailField />}
      </form.AppField>
      <form.AppField
        name="contactInfo.address"
        validators={{
          onBlur: ({ value }) => addressFieldValidator(value),
        }}
      >
        {(field) => <field.AddressField />}
      </form.AppField>
      <form.AppField
        name="contactInfo.postal"
        validators={{
          onBlurAsync: ({ value }) => postalCodeFieldValidator(value.code),
        }}
      >
        {(field) => <field.PostalCodeField />}
      </form.AppField>
      <form.AppForm>
        <form.ErrorSummary />
      </form.AppForm>
      <Button loading={addCompanyMutation.isPending} onClick={form.handleSubmit}>
        Opprett
      </Button>
    </Stack>
  );
}

export default function CompanyManager() {
  const { api } = useApiClient();
  const { data, isLoading, isError } = useQuery(api.companies.getCompanies.queryOptions());

  const createModalId = "create-company";
  return (
    <Stack>
      <Box>
        <Button
          leftSection={<IconPlus />}
          onClick={() =>
            modals.open({
              modalId: createModalId,
              children: <CreateCompanyForm onSuccess={() => modals.close(createModalId)} />,
            })
          }
        >
          Opprett selskap
        </Button>
      </Box>
      <Divider />
      <Activity mode={isLoading ? "visible" : "hidden"}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Skeleton h={100} key={`skeleton-${index}`} />
        ))}
      </Activity>
      <Activity mode={isError ? "visible" : "hidden"}>
        <ErrorAlert title="Klarte ikke laste inn selskap">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
      </Activity>
      <Activity mode={data ? "visible" : "hidden"}>
        {data?.map((company) => (
          <CompanyCard company={company} key={company.id} />
        ))}
      </Activity>
    </Stack>
  );
}
