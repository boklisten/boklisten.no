import { Button, Group } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, useEffect, useEffectEvent, useState } from "react";
import validator from "validator";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { passwordFieldValidator } from "@/shared/components/form/fields/complex/PasswordField";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { useAppForm } from "@/shared/hooks/form";
import { authQueryOptions } from "@/features/auth/authQuery";
import useAuth from "@/shared/hooks/useAuth";
import useLoginRedirect from "@/shared/hooks/useLoginRedirect";
import { GENERIC_ERROR_TEXT, PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { api } from "@/shared/utils/apiClient";

export default function LocalSignIn() {
  const [apiError, setApiError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuth();
  const { redirectAfterLogin } = useLoginRedirect();

  const signInMutation = useMutation(
    api.local.login.mutationOptions({
      onMutate: () => setApiError(null),
      onSuccess: ({ message, user }) => {
        setApiError(message ?? null);
        if (user) {
          queryClient.setQueryData(authQueryOptions().queryKey, user);
          void redirectAfterLogin();
        }
      },
      onError: (error) => {
        if (error.isStatus(429)) {
          setApiError("For mange innloggingsforsøk. Vennligst prøv igjen om 60 sekunder.");
        } else {
          setApiError(PLEASE_TRY_AGAIN_TEXT);
        }
      },
    }),
  );

  const form = useAppForm({
    defaultValues: {
      username: "",
      password: "",
    },
    onSubmit: ({ value }) => signInMutation.mutate({ body: value }),
  });

  const onAlreadyLoggedIn = useEffectEvent(() => void redirectAfterLogin());
  useEffect(() => {
    // Someone who is already logged in has nothing to do here and is redirected automatically.
    // isIdle guards against double-redirecting after a sign-in, which onSuccess already handles.
    if (isLoggedIn && signInMutation.isIdle) {
      onAlreadyLoggedIn();
    }
  }, [isLoggedIn, signInMutation.isIdle]);

  return (
    <>
      <Activity mode={apiError ? "visible" : "hidden"}>
        <ErrorAlert title={GENERIC_ERROR_TEXT}>{apiError}</ErrorAlert>
      </Activity>
      <form.AppField
        name="username"
        validators={{
          onBlur: ({ value }) =>
            (!validator.isEmail(value) && !validator.isMobilePhone(value, "nb-NO")) ||
            value.includes("+47")
              ? "Du må fylle inn gyldig e-post eller telefonnummer (uten +47)"
              : null,
        }}
      >
        {(field) => (
          <field.TextField
            required
            label="Brukernavn"
            placeholder="E-post eller telefonnummer"
            autoComplete="username"
          />
        )}
      </form.AppField>
      <form.AppField
        name="password"
        validators={{
          onBlur: ({ value }) => passwordFieldValidator(value),
        }}
      >
        {(field) => <field.PasswordField />}
      </form.AppField>
      <Button onClick={form.handleSubmit} loading={signInMutation.isPending}>
        Logg inn
      </Button>
      <Group justify="space-between">
        <TanStackAnchor size="sm" to="/auth/forgot">
          Glemt passord?
        </TanStackAnchor>
        <TanStackAnchor size="sm" to="/auth/register">
          Har du ikke konto? Registrer deg
        </TanStackAnchor>
      </Group>
    </>
  );
}
