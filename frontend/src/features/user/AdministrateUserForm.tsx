import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import type { UserPermission } from "@boklisten/backend/shared/user-permission";
import { Button, Group, Modal, Space, Stack, Text, Tooltip } from "@mantine/core";
import { IconCheck, IconInfoCircleFilled } from "@tabler/icons-react";
import { createFieldMap } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useState } from "react";

import SignatureStatusBanner from "@/features/signatures/SignatureStatusBanner";
import UserDangerZone from "@/features/user/UserDangerZone";
import type { UserInfoFieldValues } from "@/features/user/UserInfoFields";
import UserInfoFields from "@/features/user/UserInfoFields";
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
  emailVerified: boolean;
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
  userDetail: UserDetail & { permission: UserPermission };
  onSaved?: (() => void) | undefined;
  onDeleted?: (() => void) | undefined;
  onMerged?: ((toDetailsId: string) => void) | undefined;
}) {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { api, client } = useApiClient();
  const defaultValues: AdministrateUserFormValues = {
    email: userDetail.email,
    emailVerified: userDetail.emailConfirmed ?? false,
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
  const [confirmingWithoutGuardian, setConfirmingWithoutGuardian] = useState(false);
  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) => {
      if (isSavingUnderageWithoutGuardian(value)) {
        setConfirmingWithoutGuardian(true);
        return;
      }
      updateUserDetailsMutation.mutate();
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
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const updateUserDetailsMutation = useMutation({
    mutationFn: async () => {
      const formValues = form.state.values;
      const [, error] = await client.api.userDetails
        .update({
          params: { detailsId: userDetail.id },
          body: {
            email: formValues.email,
            emailVerified: formValues.emailVerified,
            name: formValues.name,
            phoneNumber: formValues.phoneNumber,
            address: formValues.address,
            postalCode: formValues.postal.code,
            postalCity: formValues.postal.city,
            dob: formValues.birthday,
            branchMembership: formValues.branchMembership,
            guardian: {
              name: formValues.guardianName,
              email: formValues.guardianEmail,
              phone: formValues.guardianPhoneNumber,
            },
          },
        })
        .safe();

      // The signature status depends on the date of birth (a guardian's signature stops counting
      // at 18), so it is refetched along with the details.
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: api.userDetails.show.queryKey({ params: { detailsId: userDetail.id } }),
        }),
        queryClient.invalidateQueries({
          queryKey: api.signatures.show.queryKey({
            params: { detailsId: userDetail.id },
          }),
        }),
      ]);

      if (error) {
        if (error.isValidationError()) {
          setServerErrors(error.response.errors.map((err) => err.message));
          return;
        }
        showErrorNotification("Noe gikk galt under registreringen!");
      } else {
        showSuccessNotification("Brukerdetaljene ble oppdatert!");
        setServerErrors([]);
        onSaved?.();
      }
    },
  });

  return (
    <Stack gap="xs">
      <form.Subscribe selector={(state) => state.values.emailVerified}>
        {(emailVerified) => (
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
                  <Tooltip label={emailVerified ? "Bekreftet" : "Ikke bekreftet"}>
                    {emailVerified ? (
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
      <form.AppField name="emailVerified">
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
        loading={form.state.isValidating || updateUserDetailsMutation.isPending}
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
            <Button
              loading={updateUserDetailsMutation.isPending}
              onClick={async () => {
                await updateUserDetailsMutation.mutateAsync();
                setConfirmingWithoutGuardian(false);
              }}
            >
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
