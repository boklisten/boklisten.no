import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { Button, Group, Space, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { IconCheck, IconInfoCircleFilled, IconMailFast } from "@tabler/icons-react";
import { createFieldMap } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Activity, useState } from "react";

import PermissionBadge from "@/features/rapid-handout/PermissionBadge";
import UserInfoFields, { UserInfoFieldValues } from "@/features/user/UserInfoFields";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import { emailFieldValidator } from "@/shared/components/form/fields/complex/EmailField";
import { nameFieldValidator } from "@/shared/components/form/fields/complex/NameField";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import { isUnder18 } from "@/shared/utils/dates";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import { Route } from "@tuyau/core/types";

export default function UserSettingsForm({
  userDetail,
}: {
  userDetail: UserDetail & { permission: UserPermission };
}) {
  const queryClient = useQueryClient();
  const { api, client } = useApiClient();
  const defaultValues: UserInfoFieldValues = {
    name: userDetail.name,
    phoneNumber: userDetail.phone,
    address: userDetail.address,
    postal: {
      code: userDetail.postCode,
      city: userDetail.postCity,
    },
    birthday: userDetail.dob ? dayjs(userDetail.dob).format("YYYY-MM-DD") : "",
    guardianName: userDetail.guardian?.name ?? "",
    guardianEmail: userDetail.guardian?.email ?? "",
    guardianPhoneNumber: userDetail.guardian?.phone ?? "",
    branchMembership: userDetail.branchMembership ?? "",
  };
  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) =>
      updateUserDetailsMutation.mutate({
        name: value.name,
        phoneNumber: value.phoneNumber,
        address: value.address,
        postalCode: value.postal.code,
        postalCity: value.postal.city,
        dob: value.birthday,
        branchMembership: value.branchMembership,
        guardian: {
          name: value.guardianName,
          email: value.guardianEmail,
          phone: value.guardianPhoneNumber,
        },
      }),
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
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const updateUserDetailsMutation = useMutation({
    mutationFn: async (payload: Route.Request<"user_detail.update_as_customer">["body"]) => {
      const [, error] = await client.api.userDetail.updateAsCustomer({ body: payload }).safe();

      await queryClient.invalidateQueries({
        queryKey: api.userDetail.getMyDetails.pathKey(),
      });

      if (error) {
        if (error.isValidationError()) {
          setServerErrors(error.response.errors.map((err) => err.message));
          return;
        }
        showErrorNotification("Noe gikk galt under registreringen!");
      } else {
        showSuccessNotification("Brukerdetaljene ble oppdatert!");
        setServerErrors([]);
      }
    },
  });
  const sendEmailVerification = useMutation(
    api.emailVerification.send.mutationOptions({
      onError: () => showErrorNotification("Klarte ikke sende ny bekreftelseslenke"),
    }),
  );

  return (
    <Stack gap={"xs"}>
      <TextInput
        disabled
        label={"E-post"}
        description={"Ta kontakt dersom du ønsker å endre e-postadresse"}
        value={userDetail.email}
        rightSection={
          <Tooltip label={userDetail.emailConfirmed ? "Bekreftet" : "Ikke bekreftet"}>
            {userDetail.emailConfirmed ? (
              <IconCheck color={"green"} />
            ) : (
              <IconInfoCircleFilled color={"orange"} />
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
            <WarningAlert title={"E-postadressen er ikke bekreftet"}>
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
        <Group gap={"xs"}>
          <Text size={"sm"} c={"dimmed"}>
            Tilgangsnivå:
          </Text>
          <PermissionBadge permission={userDetail.permission} />
        </Group>
      )}
      <Space />
      <UserInfoFields perspective={"personal"} fields={createFieldMap(defaultValues)} form={form} />
      <form.AppForm>
        <form.ErrorSummary serverErrors={serverErrors} />
      </form.AppForm>
      <Space />
      <Button
        loading={form.state.isValidating || updateUserDetailsMutation.isPending}
        onClick={form.handleSubmit}
      >
        Lagre
      </Button>
    </Stack>
  );
}
