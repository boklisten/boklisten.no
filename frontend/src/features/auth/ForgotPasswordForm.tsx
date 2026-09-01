import { Button, Stack } from "@mantine/core";
import { IconMailFast } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { Activity, useState } from "react";
import validator from "validator";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import SuccessAlert from "@/shared/components/alerts/SuccessAlert";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { useAppForm } from "@/shared/hooks/form";
import { GENERIC_ERROR_TEXT, PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { publicApiClient } from "@/shared/utils/publicApiClient";

interface ForgotFields {
  email: string;
}

export default function ForgotPasswordForm() {
  const [apiError, setApiError] = useState<string | null>(null);

  const requestPasswordResetMutation = useMutation({
    mutationFn: async ({ email }: ForgotFields) => {
      setApiError(null);
      const { message } = await publicApiClient.api.passwordReset.requestPasswordReset({
        body: {
          email,
        },
      });
      setApiError(message ?? null);
    },
    onError: () => setApiError(PLEASE_TRY_AGAIN_TEXT),
  });

  const form = useAppForm({
    defaultValues: {
      email: "",
    },
    onSubmit: ({ value }) => requestPasswordResetMutation.mutate(value),
  });

  return (
    <>
      <Stack>
        <Activity mode={apiError ? "visible" : "hidden"}>
          <ErrorAlert title={GENERIC_ERROR_TEXT}>{apiError}</ErrorAlert>
        </Activity>
        <Activity mode={requestPasswordResetMutation.isSuccess && !apiError ? "visible" : "hidden"}>
          <SuccessAlert icon={<IconMailFast />}>
            Vi har sendt en e-post med instruksjoner for hvordan du kan endre passordet ditt. Hvis
            e-posten ikke dukker opp innen noen få minutter anbefaler vi å sjekke søppelpost.
          </SuccessAlert>
        </Activity>
      </Stack>
      <form.AppField
        name="email"
        validators={{
          onBlur: ({ value }) =>
            !validator.isEmail(value) ? "Du må fylle inn en gyldig e-post" : null,
        }}
      >
        {(field) => (
          <field.TextField required label="E-post" placeholder="Din e-post" autoComplete="email" />
        )}
      </form.AppField>
      <Button loading={requestPasswordResetMutation.isPending} onClick={form.handleSubmit}>
        Reset passord
      </Button>
      <TanStackAnchor size="sm" to="/auth/login">
        Tilbake til innloggingssiden
      </TanStackAnchor>
    </>
  );
}
