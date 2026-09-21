import type { User } from "@boklisten/backend/shared/user";
import { Button, Group, Space, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconCheck, IconInfoCircleFilled, IconMailFast } from "@tabler/icons-react";
import { createFieldMap } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, useState } from "react";

import PermissionBadge from "@/features/customer-search/PermissionBadge";
import type { UserInfoFieldValues } from "@/features/user/UserInfoFields";
import UserInfoFields, { userDetailsBody } from "@/features/user/UserInfoFields";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import { emailFieldValidator } from "@/shared/components/form/fields/complex/EmailField";
import { nameFieldValidator } from "@/shared/components/form/fields/complex/NameField";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { useAppForm } from "@/shared/hooks/form";
import { api } from "@/shared/utils/apiClient";
import { isUnder18 } from "@/shared/utils/dates";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import { authQueryKey } from "@/features/auth/authQuery";

export default function UserSettingsForm({ userDetail }: { userDetail: User }) {
  const queryClient = useQueryClient();
  const defaultValues: UserInfoFieldValues = {
    name: userDetail.name,
    phoneNumber: userDetail.phone ?? "",
    address: userDetail.address,
    postal: {
      code: userDetail.postCode,
      city: userDetail.postCity,
    },
    birthday: userDetail.dob ?? "",
    guardianName: userDetail.guardianName ?? "",
    guardianEmail: userDetail.guardianEmail ?? "",
    guardianPhoneNumber: userDetail.guardianPhone ?? "",
    branchMembership: userDetail.branchMembershipId ?? "",
  };
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const updateUserMutation = useMutation(
    api.users.updateMe.mutationOptions({
      onSuccess: () => {
        setServerErrors([]);
        showSuccessNotification("Brukerdetaljene ble oppdatert!");
      },
      onError: (error) => {
        if (error.isValidationError()) {
          setServerErrors(error.response.errors.map((issue) => issue.message));
          return;
        }
        showErrorNotification("Noe gikk galt under registreringen!");
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: authQueryKey() }),
    }),
  );
  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) => updateUserMutation.mutate({ body: userDetailsBody(value) }),
    validators: {
      onSubmit: ({ value }) => {
        if (isUnder18(new Date(value.birthday))) {
          return {
            fields: {
              guardianName: nameFieldValidator(value.guardianName, "guardian"),
              guardianEmail: emailFieldValidator(value.guardianEmail, "guardian", userDetail.email),
              guardianPhoneNumber: phoneNumberFieldValidator(
                value.guardianPhoneNumber,
                "guardian",
                value.phoneNumber,
              ),
            },
          };
        }
        return null;
      },
    },
  });
  const sendEmailVerification = useMutation(
    api.emailVerification.send.mutationOptions({
      onError: () => showErrorNotification("Klarte ikke sende ny bekreftelseslenke"),
    }),
  );

  return (
    <Stack gap="xs">
      <TextInput
        disabled
        label="E-post"
        description="Ta kontakt dersom du ønsker å endre e-postadresse"
        value={userDetail.email}
        rightSection={
          <Tooltip label={userDetail.emailConfirmed ? "Bekreftet" : "Ikke bekreftet"}>
            {userDetail.emailConfirmed ? (
              <IconCheck color="green" />
            ) : (
              <IconInfoCircleFilled color="orange" />
            )}
          </Tooltip>
        }
      />
      <Activity mode={!userDetail.emailConfirmed ? "visible" : "hidden"}>
        <Stack>
          <Activity mode={sendEmailVerification.isSuccess ? "visible" : "hidden"}>
            <InfoAlert icon={<IconMailFast />}>
              Bekreftelseslenke er sendt til din e-postadresse! Sjekk søppelpost om den ikke dukker
              opp i inbox.
            </InfoAlert>
          </Activity>
          <Activity mode={!sendEmailVerification.isSuccess ? "visible" : "hidden"}>
            <WarningAlert title="E-postadressen er ikke bekreftet">
              En bekreftelseslenke har blitt sendt til {userDetail.email}. Trykk på knappen nedenfor
              for å sende en ny lenke.
            </WarningAlert>
            <Button leftSection={<IconMailFast />} onClick={() => sendEmailVerification.mutate({})}>
              Send bekreftelseslenke på nytt
            </Button>
          </Activity>
        </Stack>
      </Activity>
      {userDetail.permission !== "customer" && (
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            Tilgangsnivå:
          </Text>
          <PermissionBadge permission={userDetail.permission} />
        </Group>
      )}
      <Space />
      <UserInfoFields perspective="personal" fields={createFieldMap(defaultValues)} form={form} />
      <form.AppForm>
        <form.ErrorSummary serverErrors={serverErrors} />
      </form.AppForm>
      <Space />
      <Button
        loading={form.state.isValidating || updateUserMutation.isPending}
        onClick={form.handleSubmit}
      >
        Lagre
      </Button>
    </Stack>
  );
}
