import { Divider, Fieldset, Stack, Title } from "@mantine/core";
import dayjs from "dayjs";
import { Activity } from "react";

import { addressFieldValidator } from "@/shared/components/form/fields/complex/AddressField";
import { nameFieldValidator } from "@/shared/components/form/fields/complex/NameField";
import { phoneNumberFieldValidator } from "@/shared/components/form/fields/complex/PhoneNumberField";
import { postalCodeFieldValidator } from "@/shared/components/form/fields/complex/PostalCodeField";
import { withFieldGroup } from "@/shared/hooks/form";
import { isUnder18 } from "@/shared/utils/dates";

export interface UserInfoFieldValues {
  name: string;
  phoneNumber: string;
  address: string;
  postal: {
    code: string;
    city: string;
  };
  branchMembership: string;
  birthday: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhoneNumber: string;
}

export const userInfoFieldDefaultValues: UserInfoFieldValues = {
  name: "",
  phoneNumber: "",
  address: "",
  postal: {
    code: "",
    city: "",
  },
  branchMembership: "",
  birthday: "",
  guardianName: "",
  guardianEmail: "",
  guardianPhoneNumber: "",
};

const UserInfoFields = withFieldGroup({
  defaultValues: userInfoFieldDefaultValues,
  props: {
    perspective: "personal",
  },
  render: function Render({ group, perspective }) {
    return (
      <>
        <Stack gap={3}>
          <Title order={4}>{perspective === "personal" ? "Din" : "Kundens"} informasjon</Title>
          <Divider />
        </Stack>
        <group.AppField
          name="name"
          validators={{
            onBlur: ({ value }) => nameFieldValidator(value, perspective),
          }}
        >
          {(field) => <field.NameField />}
        </group.AppField>
        <group.AppField
          name="phoneNumber"
          validators={{
            onBlur: ({ value }) => phoneNumberFieldValidator(value, perspective),
          }}
        >
          {(field) => <field.PhoneNumberField />}
        </group.AppField>
        <group.AppField
          name="address"
          validators={{
            onBlur: ({ value }) => addressFieldValidator(value),
          }}
        >
          {(field) => <field.AddressField />}
        </group.AppField>
        <group.AppField
          name="postal"
          validators={{
            onBlurAsync: ({ value }) => postalCodeFieldValidator(value.code),
          }}
        >
          {(field) => <field.PostalCodeField />}
        </group.AppField>
        <group.AppField
          name="birthday"
          validators={{
            onBlur: ({ value }) => {
              if (!value) {
                return "Du må fylle inn fødselsdato";
              }
              if (dayjs(value, "YYYY-MM-DD").isBefore(dayjs().subtract(99, "years"))) {
                return "Du må fylle inn en gyldig fødselsdato";
              }

              return null;
            },
          }}
        >
          {(field) => (
            <field.DateField
              required
              clearable
              label="Fødselsdato"
              autoComplete="bday"
              minDate={dayjs().subtract(100, "years").toDate()}
              maxDate={dayjs().subtract(10, "years").toDate()}
              defaultDate={dayjs().subtract(18, "years").toDate()}
              defaultLevel="decade"
            />
          )}
        </group.AppField>
        <group.Subscribe selector={(state) => state.values.birthday}>
          {(birthday) => (
            <Activity mode={isUnder18(new Date(birthday)) ? "visible" : "hidden"}>
              <Fieldset
                legend={`Siden ${perspective === "personal" ? "du" : "kunden"} er under 18, trenger vi informasjon om en av ${perspective === "personal" ? "dine" : "kundens"} foresatte.`}
              >
                <Stack gap="xs">
                  <group.AppField name="guardianName">
                    {(field) => (
                      <field.NameField
                        label="Foresatt sitt fulle navn"
                        placeholder="Reodor Felgen"
                        autoComplete="section-guardian name"
                      />
                    )}
                  </group.AppField>
                  <group.AppField name="guardianEmail">
                    {(field) => (
                      <field.EmailField
                        label="Foresatt sin e-post"
                        placeholder="reodor.felgen@gmail.com"
                        autoComplete="section-guardian email"
                      />
                    )}
                  </group.AppField>
                  <group.AppField name="guardianPhoneNumber">
                    {(field) => (
                      <field.PhoneNumberField
                        label="Foresatt sitt telefonnummer"
                        autoComplete="section-guardian tel-national"
                      />
                    )}
                  </group.AppField>
                </Stack>
              </Fieldset>
            </Activity>
          )}
        </group.Subscribe>
        <group.AppField name="branchMembership">
          {(field) => <field.SelectBranchField perspective={perspective} />}
        </group.AppField>
      </>
    );
  },
});
export default UserInfoFields;
