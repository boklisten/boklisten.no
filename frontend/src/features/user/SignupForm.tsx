import { Button, Skeleton, Space, Stack } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { createFieldMap } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, useState } from "react";

import type { UserInfoFieldValues } from "@/features/user/UserInfoFields";
import UserInfoFields, {
  userFieldsBody,
  userInfoFieldDefaultValues,
} from "@/features/user/UserInfoFields";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import { emailFieldValidator } from "@/shared/components/form/fields/complex/EmailField";
import { nameFieldValidator } from "@/shared/components/form/fields/complex/NameField";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { useAppForm } from "@/shared/hooks/form";
import { authQueryOptions } from "@/features/auth/authQuery";
import useLoginRedirect from "@/shared/hooks/useLoginRedirect";
import useRootBranchId from "@/shared/hooks/useRootBranchId";
import { isUnder18 } from "@/shared/utils/dates";
import { showErrorNotification } from "@/shared/utils/notifications";
import { api } from "@/shared/utils/apiClient";

function isSchoolEmail(email: string) {
  return [
    "osloskolen.no",
    "sonans.no",
    "wangelev.no",
    "edu.nki.no",
    "stud.akademiet.no",
    "elev.ottotreider.no",
  ].some((domain) => email.includes(domain));
}

type SignupFormValues = {
  email: string;
} & UserInfoFieldValues;

interface SignupFormProps {
  phone: string;
  /** Back to typing another number. */
  onChangePhone: () => void;
}

/**
 * The details of a new account, after a login code proved `phone`. The backend takes the number
 * from the session, so it is only shown here. A new customer starts without a school, which is a
 * membership of the root, so the form waits for the branches before it opens.
 */
export default function SignupForm(props: SignupFormProps) {
  const { rootBranchId, isError, retry } = useRootBranchId();
  if (isError) {
    return (
      <ErrorAlert title="Klarte ikke hente skolene">
        <Stack gap="xs" align="flex-start">
          Registreringen trenger listen over skoler. Prøv igjen om et øyeblikk.
          <Button variant="light" size="compact-sm" leftSection={<IconRefresh />} onClick={retry}>
            Prøv igjen
          </Button>
        </Stack>
      </ErrorAlert>
    );
  }
  if (rootBranchId === undefined) {
    return (
      <Stack>
        <Skeleton height={60} />
        <Skeleton height={60} />
        <Skeleton height={60} />
      </Stack>
    );
  }
  return <SignupFields {...props} rootBranchId={rootBranchId} />;
}

function SignupFields({
  phone,
  onChangePhone,
  rootBranchId,
}: SignupFormProps & { rootBranchId: string }) {
  const defaultValues: SignupFormValues = {
    email: "",
    ...userInfoFieldDefaultValues,
    phoneNumber: phone,
    branchMembership: rootBranchId,
  };
  const queryClient = useQueryClient();
  const { redirectAfterLogin } = useLoginRedirect();
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const registerMutation = useMutation(
    api.sms.register.mutationOptions({
      onSuccess: (response) => {
        if (response.message) {
          setServerErrors([response.message]);
          return;
        }
        setServerErrors([]);
        queryClient.setQueryData(authQueryOptions().queryKey, response.user);
        void redirectAfterLogin();
      },
      onError: (error) => {
        if (error.isValidationError()) {
          setServerErrors(error.response.errors.map((issue) => issue.message));
          return;
        }
        showErrorNotification("Noe gikk galt under registreringen!");
      },
    }),
  );
  const form = useAppForm({
    defaultValues,
    onSubmit: ({ value }) =>
      registerMutation.mutate({
        body: { email: value.email, ...userFieldsBody(value) },
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
      <form.AppField
        name="email"
        validators={{
          onBlur: ({ value }) => emailFieldValidator(value, "personal"),
        }}
      >
        {(field) => (
          <field.EmailField
            deliverabilityFeedback={{ source: "signup", perspective: "personal" }}
          />
        )}
      </form.AppField>
      <form.Subscribe selector={(state) => state.values.email}>
        {(email) => (
          <Activity mode={isSchoolEmail(email) ? "visible" : "hidden"}>
            <WarningAlert>
              Vi anbefaler at du bruker din personlige e-postadresse i stedet for skolekontoen. Da
              beholder du tilgangen etter endt utdanning og kan motta viktige varsler om eventuelle
              manglende bokinnleveringer.
            </WarningAlert>
          </Activity>
        )}
      </form.Subscribe>
      <UserInfoFields
        perspective="personal"
        fields={createFieldMap(defaultValues)}
        form={form}
        leading={null}
        only={null}
        phoneAction={
          <Button variant="subtle" size="compact-sm" mr={4} onClick={onChangePhone}>
            Endre
          </Button>
        }
      />
      <Space />
      <form.AppForm>
        <form.ErrorSummary serverErrors={serverErrors} />
      </form.AppForm>
      <Button
        loading={form.state.isValidating || registerMutation.isPending}
        onClick={form.handleSubmit}
      >
        Registrer deg
      </Button>
    </Stack>
  );
}
