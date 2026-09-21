import type { User } from "@boklisten/backend/shared/user";
import { Button, Group, Modal, Space, Stack, Text, Tooltip } from "@mantine/core";
import { IconCheck, IconInfoCircleFilled } from "@tabler/icons-react";
import { createFieldMap } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import SignatureStatusBanner from "@/features/signatures/SignatureStatusBanner";
import UserDangerZone from "@/features/user/UserDangerZone";
import type { UserInfoFieldValues } from "@/features/user/UserInfoFields";
import UserInfoFields, { userDetailsBody } from "@/features/user/UserInfoFields";
import { emailFieldValidator } from "@/shared/components/form/fields/complex/EmailField";
import { nameFieldValidator } from "@/shared/components/form/fields/complex/NameField";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { useAppForm } from "@/shared/hooks/form";
import useApiClient from "@/shared/hooks/useApiClient";
import useAuth from "@/shared/hooks/useAuth";
import { isUnder18 } from "@/shared/utils/dates";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

/**
 * Above the manager modal this form usually lives in (Mantine's default 200); both render into the
 * same portal, so equal z-indexes would leave the confirm hidden behind the form.
 */
const CONFIRM_Z_INDEX = 250;

type AdministrateUserFormValues = {
  email: string;
  emailConfirmed: boolean;
} & UserInfoFieldValues;

/**
 * Employees correcting a date of birth rarely know the customer's guardian. With nothing at all
 * filled in they may save anyway (after confirming); anything typed in must still be valid.
 */
function isSavingUnderageWithoutGuardian(values: UserInfoFieldValues): boolean {
  return (
    isUnder18(new Date(values.birthday)) &&
    [values.guardianName, values.guardianEmail, values.guardianPhoneNumber].every(
      (value) => value.trim().length === 0,
    )
  );
}

export default function AdministrateUserForm({
  userDetail,
  onSaved,
  onDeleted,
  onMerged,
}: {
  userDetail: User;
  onSaved?: (() => void) | undefined;
  onDeleted?: (() => void) | undefined;
  onMerged?: ((toDetailsId: string) => void) | undefined;
}) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { api } = useApiClient();
  const defaultValues: AdministrateUserFormValues = {
    email: userDetail.email,
    emailConfirmed: userDetail.emailConfirmed,
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
  const [confirmingWithoutGuardian, setConfirmingWithoutGuardian] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const updateUserMutation = useMutation(
    api.users.update.mutationOptions({
      onSuccess: () => {
        setServerErrors([]);
        showSuccessNotification("Brukerdetaljene ble oppdatert!");
        onSaved?.();
      },
      onError: (error) => {
        if (error.isValidationError()) {
          setServerErrors(error.response.errors.map((issue) => issue.message));
          return;
        }
        showErrorNotification("Noe gikk galt under registreringen!");
      },
      // The signature status depends on the date of birth (a guardian's signature stops counting
      // at 18), so it is refetched along with the details.
      onSettled: () => {
        setConfirmingWithoutGuardian(false);
        return Promise.all([
          queryClient.invalidateQueries({
            queryKey: api.users.show.queryKey({ params: { detailsId: userDetail.id } }),
          }),
          queryClient.invalidateQueries({
            queryKey: api.signatures.show.queryKey({ params: { detailsId: userDetail.id } }),
          }),
        ]);
      },
    }),
  );
  const save = (values: AdministrateUserFormValues) =>
    updateUserMutation.mutate({
      params: { detailsId: userDetail.id },
      body: {
        ...userDetailsBody(values),
        email: values.email,
        emailConfirmed: values.emailConfirmed,
      },
    });
  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) => {
      if (isSavingUnderageWithoutGuardian(value)) {
        setConfirmingWithoutGuardian(true);
        return;
      }
      save(value);
    },
    validators: {
      onSubmit: ({ value }) => {
        if (isUnder18(new Date(value.birthday)) && !isSavingUnderageWithoutGuardian(value)) {
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
                rightSection={
                  <Tooltip label={emailConfirmed ? "Bekreftet" : "Ikke bekreftet"}>
                    {emailConfirmed ? (
                      <IconCheck color="green" />
                    ) : (
                      <IconInfoCircleFilled color="orange" />
                    )}
                  </Tooltip>
                }
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
      <SignatureStatusBanner userDetail={userDetail} inForm />
      <UserInfoFields
        perspective="administrate"
        fields={createFieldMap(defaultValues)}
        form={form}
      />
      <form.AppForm>
        <form.ErrorSummary serverErrors={serverErrors} />
      </form.AppForm>
      <Space />
      <Button
        loading={form.state.isValidating || updateUserMutation.isPending}
        onClick={async () => {
          // handleSubmit only runs field-level validators before giving up on an invalid form, so
          // guardian errors a previous attempt left on untouched fields would keep blocking even
          // after the fields were cleared. Recompute the form-level errors first.
          await form.validate("submit");
          await form.handleSubmit();
        }}
      >
        Lagre
      </Button>
      {/* A plain Modal rather than the modals manager: this form usually lives inside a manager
          modal, and stacking another manager modal on top would unmount it and reset the form. */}
      <Modal
        opened={confirmingWithoutGuardian}
        onClose={() => setConfirmingWithoutGuardian(false)}
        title="Lagre uten foresatt?"
        zIndex={CONFIRM_Z_INDEX}
      >
        <Stack>
          <Text size="sm">
            Kunden er under 18, men informasjon om foresatt er ikke fylt ut. Kunden må selv fylle ut
            dette neste gang de logger inn.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmingWithoutGuardian(false)}>
              Avbryt
            </Button>
            <Button loading={updateUserMutation.isPending} onClick={() => save(form.state.values)}>
              Lagre uten foresatt
            </Button>
          </Group>
        </Stack>
      </Modal>
      {isAdmin && (
        <>
          <Space />
          <UserDangerZone userDetail={userDetail} onDeleted={onDeleted} onMerged={onMerged} />
        </>
      )}
    </Stack>
  );
}
