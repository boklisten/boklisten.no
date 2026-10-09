import type { User } from "@boklisten/backend/shared/user";
import { Button, Space, Stack } from "@mantine/core";
import { IconMailFast } from "@tabler/icons-react";
import { createFieldMap } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, useState } from "react";

import type { UserInfoFieldValues } from "@/features/user/UserInfoFields";
import ChangePhoneModal from "@/features/user/ChangePhoneModal";
import EmailConfirmedMark from "@/features/user/EmailConfirmedMark";
import UserInfoFields, { missingUserInfo, userFieldsBody } from "@/features/user/UserInfoFields";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import { emailFieldValidator } from "@/shared/components/form/fields/complex/EmailField";
import { nameFieldValidator } from "@/shared/components/form/fields/complex/NameField";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { useAppForm } from "@/shared/hooks/form";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { api } from "@/shared/utils/apiClient";
import { isUnder18 } from "@/shared/utils/dates";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import { authQueryKey } from "@/features/auth/authQuery";

type UserSettingsValues = { email: string } & UserInfoFieldValues;

function valuesOf(user: User): UserSettingsValues {
  return {
    email: user.email,
    name: user.name ?? "",
    phoneNumber: user.phone ?? "",
    address: user.address ?? "",
    postCode: user.postCode ?? "",
    birthday: user.dob ?? "",
    guardianName: user.guardianName ?? "",
    guardianEmail: user.guardianEmail ?? "",
    guardianPhoneNumber: user.guardianPhone ?? "",
    branchMembership: user.branchMembershipId ?? "",
  };
}

function bodyOf(values: UserSettingsValues) {
  return { ...userFieldsBody(values), email: values.email };
}

/**
 * The user's own details, email included. On the settings page they auto-save (see `useAutoSave`);
 * in the confirm-details task the user instead confirms everything at once with "Lagre", shown only
 * the details still missing (often just the date of birth after a Vipps login); the rest are on
 * the settings page. A new
 * email starts unconfirmed; the backend sends a link to it. The phone is what they log in with,
 * so it changes only through `ChangePhoneModal`, which saves it by itself.
 */
export default function UserSettingsForm({
  user,
  confirmDetails = false,
}: {
  user: User;
  /** In the confirm-details task: one "Lagre" that confirms the details, instead of auto-save. */
  confirmDetails?: boolean;
}) {
  const queryClient = useQueryClient();
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [changingPhone, setChangingPhone] = useState(false);
  // Fixed when the task opens, so a field does not vanish once it is filled in.
  const [only] = useState(() => {
    const missing = missingUserInfo(valuesOf(user));
    return confirmDetails && missing.size > 0 ? missing : null;
  });
  const updateUserMutation = useMutation(
    api.users.updateMe.mutationOptions({
      onSuccess: () => {
        setServerErrors([]);
        if (confirmDetails) {
          showSuccessNotification("Brukerdetaljene ble oppdatert!");
        }
      },
      onError: (error) => {
        if (error.isValidationError()) {
          setServerErrors(error.response.errors.map((issue) => issue.message));
          return;
        }
        if (confirmDetails) {
          showErrorNotification("Noe gikk galt under registreringen!");
        }
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: authQueryKey() }),
    }),
  );
  const form = useAppForm({
    ...useAutoSave({
      defaultValues: valuesOf(user),
      persist: (values) => updateUserMutation.mutateAsync({ body: bodyOf(values) }),
    }),
    // The confirm-details task confirms everything at once with its button instead.
    ...(confirmDetails && {
      listeners: {},
      onSubmit: ({ value }: { value: UserSettingsValues }) =>
        updateUserMutation.mutate({ body: bodyOf(value) }),
    }),
    validators: {
      onSubmit: ({ value }) => {
        if (isUnder18(new Date(value.birthday))) {
          return {
            fields: {
              guardianName: nameFieldValidator(value.guardianName, "guardian"),
              guardianEmail: emailFieldValidator(value.guardianEmail, "guardian", value.email),
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

  return (
    <Stack gap="xs">
      <UserInfoFields
        perspective="personal"
        fields={createFieldMap(valuesOf(user))}
        form={form}
        only={only}
        phoneAction={
          <Button variant="subtle" size="compact-sm" mr={4} onClick={() => setChangingPhone(true)}>
            {user.phone ? "Endre" : "Legg til"}
          </Button>
        }
        leading={
          only === null && (
            <>
              <form.AppField
                name="email"
                validators={{
                  onBlur: ({ value }) => emailFieldValidator(value, "personal"),
                }}
              >
                {(field) => (
                  <field.EmailField
                    deliverabilityFeedback={{ source: "settings", perspective: "personal" }}
                    rightSection={
                      // The mark is about the saved address; a new one is unconfirmed until saved.
                      <EmailConfirmedMark
                        confirmed={
                          user.emailConfirmed &&
                          field.state.value.trim().toLowerCase() === user.email.toLowerCase()
                        }
                      />
                    }
                  />
                )}
              </form.AppField>
              <Activity mode={user.emailConfirmed ? "hidden" : "visible"}>
                <EmailUnconfirmed key={user.email} email={user.email} />
              </Activity>
            </>
          )
        }
      />
      <ChangePhoneModal
        opened={changingPhone}
        onClose={() => setChangingPhone(false)}
        onChanged={(phone) => {
          // Saved already; the field only shows it.
          form.setFieldValue("phoneNumber", phone, { dontUpdateMeta: true });
          void queryClient.invalidateQueries({ queryKey: authQueryKey() });
        }}
      />
      <form.AppForm>
        <form.ErrorSummary serverErrors={serverErrors} autoSave={!confirmDetails} />
      </form.AppForm>
      {confirmDetails && (
        <>
          <Space />
          <Button
            loading={form.state.isValidating || updateUserMutation.isPending}
            onClick={async () => {
              // Recompute the form-level guardian errors first; handleSubmit stops at stale ones.
              await form.validate("submit");
              await form.handleSubmit();
            }}
          >
            Lagre
          </Button>
        </>
      )}
    </Stack>
  );
}

/**
 * Under an unconfirmed email: where the link went and a way to send another. Keyed by the address
 * where it is used, so "sent" is never left over from an earlier one.
 */
function EmailUnconfirmed({ email }: { email: string }) {
  const sendEmailVerification = useMutation(
    api.emailVerification.send.mutationOptions({
      onError: () => showErrorNotification("Klarte ikke sende ny bekreftelseslenke"),
    }),
  );
  if (sendEmailVerification.isSuccess) {
    return (
      <InfoAlert icon={<IconMailFast />}>
        Ny bekreftelseslenke er sendt til {email}. Sjekk søppelpost om den ikke dukker opp i
        innboksen.
      </InfoAlert>
    );
  }
  return (
    <Stack gap="xs">
      <WarningAlert title="E-postadressen er ikke bekreftet">
        Vi har sendt en bekreftelseslenke til {email}. Trykk på lenken i e-posten, eller be om en
        ny.
      </WarningAlert>
      <Button
        variant="light"
        leftSection={<IconMailFast />}
        loading={sendEmailVerification.isPending}
        onClick={() => sendEmailVerification.mutate({})}
      >
        Send ny bekreftelseslenke
      </Button>
    </Stack>
  );
}
