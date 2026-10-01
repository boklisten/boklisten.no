import { Fieldset, Stack } from "@mantine/core";
import dayjs from "dayjs";
import { Activity } from "react";
import type { ReactNode } from "react";

import FormSectionTitle from "@/features/user/FormSectionTitle";
import WarningAlert from "@/shared/components/alerts/WarningAlert";
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

/** The field values as the `users` endpoints take them; blank optional fields are sent as null. */
export function userFieldsBody(values: UserInfoFieldValues) {
  return {
    name: values.name,
    phone: values.phoneNumber,
    address: values.address,
    postCode: values.postal.code,
    postCity: values.postal.city,
    dob: values.birthday,
    branchMembershipId: values.branchMembership || null,
    guardianName: values.guardianName || null,
    guardianEmail: values.guardianEmail || null,
    guardianPhone: values.guardianPhoneNumber || null,
  };
}

/**
 * Employees correcting a date of birth rarely know the customer's guardian. With nothing at all
 * filled in they may save anyway; anything typed in must still be valid.
 */
export function isUnderageWithoutGuardian(values: UserInfoFieldValues): boolean {
  return (
    isUnder18(new Date(values.birthday)) &&
    [values.guardianName, values.guardianEmail, values.guardianPhoneNumber].every(
      (value) => value.trim().length === 0,
    )
  );
}

/**
 * The fields auto-save listens to on change; the rest save on blur. The date of birth is one of
 * the rest: it changes on every keystroke that parses, so a half-typed year would be saved.
 */
export function savesOnChange(fieldName: string, values: UserInfoFieldValues): boolean {
  // The postal code saves once the lookup has filled in the city, not on every keystroke.
  if (fieldName === "postal") {
    return values.postal.city.length > 0;
  }
  return fieldName === "branchMembership";
}

/** The parts of a user form's api that auto-save uses, without TanStack Form's many generics. */
export interface AutoSavedForm<Values> {
  validateAllFields: (cause: "blur") => Promise<unknown>;
  validate: (cause: "submit") => unknown;
  state: { isValid: boolean; values: Values };
}

/**
 * Runs every check a save must pass: each field's own validators (they run on blur, so this also
 * covers fields the user has not visited) and then the form-level guardian rules. The explicit
 * form-level run also clears guardian errors a rule that no longer applies left on untouched fields.
 */
export async function isWholeFormValid(form: AutoSavedForm<unknown>): Promise<boolean> {
  await form.validateAllFields("blur");
  await form.validate("submit");
  return form.state.isValid;
}

const UserInfoFields = withFieldGroup({
  defaultValues: userInfoFieldDefaultValues,
  props: {
    perspective: "personal" as "personal" | "administrate",
    /** Fields of the host form that belong in this section, right under its title (the email). */
    leading: null as ReactNode,
  },
  render: ({ group, perspective, leading }) => (
    <>
      <FormSectionTitle>
        {perspective === "personal" ? "Din" : "Kundens"} informasjon
      </FormSectionTitle>
      {leading}
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
                      deliverabilityFeedback={{ source: "guardian", perspective }}
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
                {perspective === "administrate" && (
                  <group.Subscribe selector={(state) => isUnderageWithoutGuardian(state.values)}>
                    {(withoutGuardian) =>
                      withoutGuardian && (
                        <WarningAlert title="Foresatt mangler">
                          Kunden må selv fylle ut informasjon om foresatt neste gang de logger inn.
                        </WarningAlert>
                      )
                    }
                  </group.Subscribe>
                )}
              </Stack>
            </Fieldset>
          </Activity>
        )}
      </group.Subscribe>
      <group.AppField name="branchMembership">
        {(field) => <field.SelectBranchField perspective={perspective} />}
      </group.AppField>
    </>
  ),
});
export default UserInfoFields;
