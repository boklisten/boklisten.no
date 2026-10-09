import { Button, Divider, Stack, Text, Title } from "@mantine/core";
import { IconMessage } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { authQueryOptions } from "@/features/auth/authQuery";
import { codeRequestErrorText } from "@/features/auth/codeRequestError";
import SmsCodeEntry from "@/features/auth/SmsCodeEntry";
import SmsPhoneForm from "@/features/auth/SmsPhoneForm";
import VippsButton from "@/features/auth/VippsButton";
import SignupForm from "@/features/user/SignupForm";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import useAuth from "@/shared/hooks/useAuth";
import useLoginRedirect from "@/shared/hooks/useLoginRedirect";
import { api } from "@/shared/utils/apiClient";

/**
 * Login buttons at their natural size on a wide screen, wide enough for the subtitle on one line;
 * a phone gives them its full width.
 */
const NARROW_WIDTH = 400;

type Step =
  | { kind: "choose" }
  | { kind: "phone" }
  /** `sends` counts the codes sent to the number, so a new one restarts the code entry. */
  | { kind: "code"; phone: string; accountExists: boolean; sends: number }
  | { kind: "signup"; phone: string };

/**
 * Login and sign-up in one: Vipps creates a missing account by itself, and a code sent by SMS
 * proves a number with or without an account, after which a new customer fills in their
 * details. Vipps comes first; SMS takes an extra tap, for those without Vipps.
 */
export default function SignIn() {
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const [error, setError] = useState<string | null>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuth();
  const { redirectAfterLogin } = useLoginRedirect();

  const sendMutation = useMutation(
    api.sms.send.mutationOptions({
      onMutate: () => setError(null),
      onSuccess: (response, { body: { phone } }) => {
        if (response.message) {
          setError(response.message);
          return;
        }
        setStep((previous) =>
          previous.kind === "code" && previous.phone === phone
            ? { ...previous, sends: previous.sends + 1 }
            : { kind: "code", phone, accountExists: response.accountExists ?? false, sends: 1 },
        );
      },
      onError: (sendError) => setError(codeRequestErrorText(sendError)),
    }),
  );
  const verifyMutation = useMutation(
    api.sms.verify.mutationOptions({
      onMutate: () => setError(null),
      onError: (verifyError) => setError(codeRequestErrorText(verifyError)),
    }),
  );

  const onAlreadyLoggedIn = useEffectEvent(() => void redirectAfterLogin());
  useEffect(() => {
    // Someone who is already logged in has nothing to do here. Not after a login on this page,
    // which redirects by itself.
    if (isLoggedIn && verifyMutation.isIdle) {
      onAlreadyLoggedIn();
    }
  }, [isLoggedIn, verifyMutation.isIdle]);

  function startOver() {
    setError(null);
    setStep({ kind: "phone" });
  }

  if (step.kind === "signup") {
    return (
      <Stack>
        <Title ta="center">Fullfør registreringen</Title>
        <Text ta="center">Nummeret er bekreftet. Fyll inn resten av opplysningene dine.</Text>
        <SignupForm phone={step.phone} onChangePhone={startOver} />
      </Stack>
    );
  }

  if (step.kind === "code") {
    const { phone } = step;
    return (
      <Stack maw={NARROW_WIDTH} mx="auto">
        <Title ta="center">Skriv inn koden</Title>
        <SmsCodeEntry
          key={step.sends}
          phone={phone}
          pending={verifyMutation.isPending}
          error={error}
          resendPending={sendMutation.isPending}
          onResend={() => sendMutation.mutate({ body: { phone } })}
          onChangeNumber={startOver}
          notice={
            !step.accountExists && (
              <InfoAlert>
                Dette nummeret er ikke registrert hos oss. Når koden er bekreftet, kan du registrere
                deg.
              </InfoAlert>
            )
          }
          onCode={async (code) => {
            const response = await verifyMutation.mutateAsync({ body: { phone, code } });
            if (response.message) {
              setError(response.message);
              return false;
            }
            if (response.signUp) {
              setStep({ kind: "signup", phone });
              return true;
            }
            queryClient.setQueryData(authQueryOptions().queryKey, response.user);
            void redirectAfterLogin();
            return true;
          }}
        />
      </Stack>
    );
  }

  // Two groups: the way we want people to take (heading and Vipps), then the alternative.
  return (
    <Stack maw={NARROW_WIDTH} mx="auto" gap="xl">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title ta="center">Logg inn</Title>
          <Text ta="center" size="sm" c="dimmed" style={{ textWrap: "balance" }}>
            Hvis du ikke har konto, opprettes en ny når du logger inn.
          </Text>
        </Stack>
        <VippsButton />
      </Stack>
      <Stack>
        <Divider label="Har du ikke Vipps?" />
        {step.kind === "choose" ? (
          <Button
            variant="default"
            size="sm"
            // Smaller than the Vipps button, which is the way we want people to take.
            style={{ alignSelf: "center" }}
            leftSection={<IconMessage size={18} />}
            onClick={() => {
              // Focused inside the tap, or iOS keeps the keyboard closed.
              flushSync(() => setStep({ kind: "phone" }));
              phoneInput.current?.focus();
            }}
          >
            Logg inn med SMS
          </Button>
        ) : (
          <SmsPhoneForm
            label="Mobilnummer"
            inputRef={phoneInput}
            error={error}
            pending={sendMutation.isPending}
            onSend={(phone) => sendMutation.mutate({ body: { phone } })}
          />
        )}
      </Stack>
    </Stack>
  );
}
