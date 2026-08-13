import { Button, Group, Space, Stack, Text } from "@mantine/core";
import { createFieldMap } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { Activity, useState } from "react";

import UserInfoFields, {
  userInfoFieldDefaultValues,
  UserInfoFieldValues,
} from "@/features/user/UserInfoFields";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
import { emailFieldValidator } from "@/shared/components/form/fields/complex/EmailField";
import { nameFieldValidator } from "@/shared/components/form/fields/complex/NameField";
import { newPasswordFieldValidator } from "@/shared/components/form/fields/complex/NewPasswordField";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { useAppForm } from "@/shared/hooks/form";
import { login } from "@/shared/hooks/useAuth";
import useAuthLinker from "@/shared/hooks/useAuthLinker";
import { isUnder18 } from "@/shared/utils/dates";
import { showErrorNotification } from "@/shared/utils/notifications";
import { publicApiClient } from "@/shared/utils/publicApiClient";

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
  password: string;
  agreeToTermsAndConditions: boolean;
} & UserInfoFieldValues;

const defaultValues: SignupFormValues = {
  email: "",
  password: "",
  ...userInfoFieldDefaultValues,
  agreeToTermsAndConditions: false,
};

export default function SignupForm() {
  const { redirectToCaller } = useAuthLinker();
  const form = useAppForm({
    defaultValues,
    onSubmit: () => registerMutation.mutate(),
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
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const registerMutation = useMutation({
    mutationFn: async () => {
      const formValues = form.state.values;
      const [data, error] = await publicApiClient.api.local
        .register({
          body: {
            email: formValues.email,
            phoneNumber: formValues.phoneNumber,
            password: formValues.password,

            name: formValues.name,
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

      if (error) {
        if (error.isValidationError()) {
          setServerErrors(error.response.errors.map((err) => err.message));
          return;
        }
        showErrorNotification("Noe gikk galt under registreringen!");
      }

      setServerErrors([]);
      if (data) {
        login(data);
        redirectToCaller();
      }
    },
  });

  return (
    <Stack gap={"xs"}>
      <form.AppField
        name={"email"}
        validators={{
          onBlur: ({ value }) => emailFieldValidator(value, "personal"),
        }}
      >
        {(field) => <field.EmailField />}
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
      <form.AppField
        name={"password"}
        validators={{
          onBlur: ({ value }) => newPasswordFieldValidator(value),
        }}
      >
        {(field) => <field.NewPasswordField />}
      </form.AppField>
      <UserInfoFields perspective={"personal"} fields={createFieldMap(defaultValues)} form={form} />
      <Space />
      <form.AppField
        name={"agreeToTermsAndConditions"}
        validators={{
          onChange: ({ value }) => (!value ? "Du må godta våre betingelser og vilkår" : ""),
        }}
      >
        {(field) => (
          <field.CheckboxField
            required
            label={
              <Group gap={3}>
                <Text size={"sm"}>
                  {"Jeg godtar Boklistens "}
                  <TanStackAnchor to={"/info/policies/conditions"} target={"_blank"}>
                    betingelser
                  </TanStackAnchor>
                  {" og "}
                  <TanStackAnchor to={"/info/policies/terms"} target={"_blank"}>
                    vilkår
                  </TanStackAnchor>
                </Text>
                <Text size={"sm"} c={"var(--mantine-color-error)"}>
                  *
                </Text>
              </Group>
            }
          />
        )}
      </form.AppField>
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
