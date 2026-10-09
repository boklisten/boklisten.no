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

/**
 * The field values as the `users` endpoints take them; blank optional fields are sent as null.
 * Without the phone, which only the employee form sends.
 */
export function userFieldsBody(values: UserInfoFieldValues) {
  return {
    name: values.name,
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

/** The parts of the section that can be shown on their own; the guardian's fields go together. */
export type UserInfoPart =
  | "phoneNumber"
  | "name"
  | "address"
  | "postal"
  | "birthday"
  | "guardian"
  | "branchMembership";

/**
 * The parts a customer has yet to fill in: the details the backend requires (`invalidUserFields`)
 * and, while none is chosen, the optional school.
 */
export function missingUserInfo(values: UserInfoFieldValues): Set<UserInfoPart> {
  const missing = new Set<UserInfoPart>();
  for (const part of ["phoneNumber", "name", "address", "birthday", "branchMembership"] as const) {
    if (!values[part].trim()) {
      missing.add(part);
    }
  }
  if (!values.postal.code || !values.postal.city) {
    missing.add("postal");
  }
  if (
    isUnder18(new Date(values.birthday)) &&
    [values.guardianName, values.guardianEmail, values.guardianPhoneNumber].some(
      (value) => !value.trim(),
    )
  ) {
    missing.add("guardian");
  }
  return missing;
}

const UserInfoFields = withFieldGroup({
  defaultValues: userInfoFieldDefaultValues,
  props: {
    perspective: "personal" as "personal" | "administrate",
    /** Fields of the host form that belong in this section, right under its title (the email). */
    leading: null as ReactNode,
    /** The personal forms' button for changing the read-only phone. */
    phoneAction: null as ReactNode,
    /** Only these parts, or all of them. A date of birth typed in here brings the guardian along. */
    only: null as ReadonlySet<UserInfoPart> | null,
  },
  render: ({ group, perspective, leading, phoneAction, only }) => {
    const shows = (part: UserInfoPart) => only === null || only.has(part);
    return (
      <>
        <FormSectionTitle>
          {perspective === "personal" ? "Din" : "Kundens"} informasjon
        </FormSectionTitle>
        {leading}
        {shows("phoneNumber") && (
          <group.AppField
            name="phoneNumber"
            // Read-only for the customer, so a missing phone must not block saving the rest.
            validators={
              perspective === "administrate"
                ? { onBlur: ({ value }) => phoneNumberFieldValidator(value, perspective) }
                : undefined
            }
          >
            {(field) => (
              <field.PhoneNumberField
                readOnly={perspective === "personal"}
                rightSection={phoneAction}
                rightSectionWidth="auto"
              />
            )}
          </group.AppField>
        )}
        {shows("name") && (
          <group.AppField
            name="name"
            validators={{
              onBlur: ({ value }) => nameFieldValidator(value, perspective),
            }}
          >
            {(field) => <field.NameField />}
          </group.AppField>
        )}
        {shows("address") && (
          <group.AppField
            name="address"
            validators={{
              onBlur: ({ value }) => addressFieldValidator(value),
            }}
          >
            {(field) => <field.AddressField />}
          </group.AppField>
        )}
        {shows("postal") && (
          <group.AppField
            name="postal"
            validators={{
              onBlurAsync: ({ value }) => postalCodeFieldValidator(value.code),
            }}
          >
            {(field) => <field.PostalCodeField />}
          </group.AppField>
        )}
        {shows("birthday") && (
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
        )}
        <group.Subscribe selector={(state) => state.values.birthday}>
          {(birthday) => (
            <Activity
              mode={
                isUnder18(new Date(birthday)) && (shows("guardian") || shows("birthday"))
                  ? "visible"
                  : "hidden"
              }
            >
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
                            Kunden må selv fylle ut informasjon om foresatt neste gang de logger
                            inn.
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
        {shows("branchMembership") && (
          <group.AppField name="branchMembership">
            {(field) => <field.SelectBranchField perspective={perspective} />}
          </group.AppField>
        )}
      </>
    );
  },
});
export default UserInfoFields;
