import type { User } from "@boklisten/backend/shared/user";
import { Space, Stack } from "@mantine/core";
import { createFieldMap } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import SignatureStatusBanner from "@/features/signatures/SignatureStatusBanner";
import EmailConfirmedMark from "@/features/user/EmailConfirmedMark";
import UserDangerZone from "@/features/user/UserDangerZone";
import type { UserInfoFieldValues } from "@/features/user/UserInfoFields";
import UserInfoFields, {
  isUnderageWithoutGuardian,
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
    phone: values.phoneNumber,
    email: values.email,
    emailConfirmed: values.emailConfirmed,
  };
}

/**
 * An employee editing a customer, auto-saved (see `useAutoSave`). An underage customer without any
 * guardian details saves anyway, with a warning that they must add them themselves.
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
  const autoSave = useAutoSave({
    defaultValues: valuesOf(user),
    persist: (values) =>
      updateUserMutation.mutateAsync({ params: { userId: user.id }, body: bodyOf(values) }),
    invalidates: [
      api.users.show.queryKey({ params: { userId: user.id } }),
      // The signature status depends on the date of birth (a guardian's signature stops counting
      // at 18), so it is refetched along with the details.
      api.signatures.show.queryKey({ params: { userId: user.id } }),
    ],
  });
  const form = useAppForm({
    ...autoSave,
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
  });

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
        fields={createFieldMap(autoSave.defaultValues)}
        form={form}
        leading={null}
        phoneAction={null}
      />
      <form.AppForm>
        <form.ErrorSummary serverErrors={serverErrors} autoSave />
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
