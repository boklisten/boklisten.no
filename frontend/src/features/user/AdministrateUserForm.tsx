import type { User } from "@boklisten/backend/shared/user";
import { Space, Stack } from "@mantine/core";
import { createFieldMap } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import SignatureStatusBanner from "@/features/signatures/SignatureStatusBanner";
import EmailConfirmedMark from "@/features/user/EmailConfirmedMark";
import UserDangerZone from "@/features/user/UserDangerZone";
import type { AutoSavedForm, UserInfoFieldValues } from "@/features/user/UserInfoFields";
import UserInfoFields, {
  isUnderageWithoutGuardian,
  isWholeFormValid,
  savesOnChange,
  userFieldsBody,
} from "@/features/user/UserInfoFields";
import { emailFieldValidator } from "@/shared/components/form/fields/complex/EmailField";
import { nameFieldValidator } from "@/shared/components/form/fields/complex/NameField";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { useAppForm } from "@/shared/hooks/form";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { api } from "@/shared/utils/apiClient";
import useAuth from "@/shared/hooks/useAuth";
import { isUnder18 } from "@/shared/utils/dates";

type AdministrateUserFormValues = {
  email: string;
  emailConfirmed: boolean;
} & UserInfoFieldValues;

function valuesOf(user: User): AdministrateUserFormValues {
  return {
    email: user.email,
    emailConfirmed: user.emailConfirmed,
    name: user.name ?? "",
    phoneNumber: user.phone ?? "",
    address: user.address ?? "",
    postal: {
      code: user.postCode ?? "",
      city: user.postCity ?? "",
    },
    birthday: user.dob ?? "",
    guardianName: user.guardianName ?? "",
    guardianEmail: user.guardianEmail ?? "",
    guardianPhoneNumber: user.guardianPhone ?? "",
    branchMembership: user.branchMembershipId ?? "",
  };
}

function bodyOf(values: AdministrateUserFormValues) {
  return {
    ...userFieldsBody(values),
    email: values.email,
    emailConfirmed: values.emailConfirmed,
  };
}

/**
 * An employee editing a customer, with auto-save (see `useAutoSave`): text fields and the date on
 * blur, the switch and school on change, and only once the whole form is valid. An underage customer
 * without any guardian details saves anyway, with a warning that they must add them themselves.
 */
export default function AdministrateUserForm({
  user,
  onDeleted,
  onMerged,
}: {
  user: User;
  onDeleted?: (() => void) | undefined;
  onMerged?: ((toUserId: string) => void) | undefined;
}) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  // The form starts from the customer as they were when the editor opened; the refetch after each
  // save must not reset what the employee is typing.
  // oxlint-disable-next-line react/hook-use-state -- never set again, so no setter
  const [defaultValues] = useState(() => valuesOf(user));
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const updateUserMutation = useMutation(
    api.users.update.mutationOptions({
      onSuccess: () => setServerErrors([]),
      onError: (error) => {
        if (error.isValidationError()) {
          setServerErrors(error.response.errors.map((issue) => issue.message));
        }
      },
    }),
  );
  const { save } = useAutoSave({
    initialBody: bodyOf(defaultValues),
    persist: (body) => updateUserMutation.mutateAsync({ params: { userId: user.id }, body }),
    notifications: {
      id: `user-saved-${user.id}`,
      saved: "Brukerdetaljene ble lagret!",
      failed: "Klarte ikke lagre brukerdetaljene",
    },
    // The signature status depends on the date of birth (a guardian's signature stops counting at
    // 18), so it is refetched along with the details.
    onSaved: () =>
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: api.users.show.queryKey({ params: { userId: user.id } }),
        }),
        queryClient.invalidateQueries({
          queryKey: api.signatures.show.queryKey({ params: { userId: user.id } }),
        }),
      ]),
  });
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: ({ value }) => {
        if (isUnder18(new Date(value.birthday)) && !isUnderageWithoutGuardian(value)) {
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
    listeners: {
      onBlur: ({ formApi }) => {
        void saveIfValid(formApi);
      },
      onChange: ({ fieldApi, formApi }) => {
        if (
          fieldApi.name === "emailConfirmed" ||
          savesOnChange(fieldApi.name, formApi.state.values)
        ) {
          void saveIfValid(formApi);
        }
      },
    },
  });

  async function saveIfValid(formApi: AutoSavedForm<AdministrateUserFormValues>) {
    if (await isWholeFormValid(formApi)) {
      save(bodyOf(formApi.state.values));
    }
  }

  return (
    <Stack gap="xs">
      <form.Subscribe selector={(state) => state.values.emailConfirmed}>
        {(emailConfirmed) => (
          <form.AppField
            name="email"
            validators={{
              onBlur: ({ value }) => emailFieldValidator(value, "personal"),
            }}
          >
            {(field) => (
              <field.EmailField
                deliverabilityFeedback={{ source: "administrate", perspective: "administrate" }}
                rightSection={<EmailConfirmedMark confirmed={emailConfirmed} />}
              />
            )}
          </form.AppField>
        )}
      </form.Subscribe>
      <form.AppField name="emailConfirmed">
        {(field) => <field.SwitchField label="E-post bekreftet" />}
      </form.AppField>
      <Space />
      {/* Above the customer's own details: the contract is the first thing to check on them */}
      <SignatureStatusBanner user={user} inForm />
      <UserInfoFields
        perspective="administrate"
        fields={createFieldMap(defaultValues)}
        form={form}
        leading={null}
      />
      <form.AppForm>
        <form.ErrorSummary
          serverErrors={serverErrors}
          title="Endringene lagres når du har rettet opp dette"
        />
      </form.AppForm>
      {isAdmin && (
        <>
          <Space />
          <UserDangerZone user={user} onDeleted={onDeleted} onMerged={onMerged} />
        </>
      )}
    </Stack>
  );
}
