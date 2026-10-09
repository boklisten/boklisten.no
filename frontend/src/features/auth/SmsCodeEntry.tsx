import { Anchor, Button, Center, Group, PinInput, Stack, Text } from "@mantine/core";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";

const CODE_LENGTH = 6;
/** The backend sends a new code to the same number at most this often. */
const RESEND_AFTER_SECONDS = 30;

/** "40851068" as Norwegians write a mobile number: "408 51 068". */
function formatPhone(phone: string): string {
  return phone.replace(
    /^(?<first>\d{3})(?<second>\d{2})(?<third>\d{3})$/,
    "$<first> $<second> $<third>",
  );
}

function secondsSince(time: number) {
  return Math.floor((Date.now() - time) / 1000);
}

/**
 * Chrome on Android can read the code straight from the SMS (WebOTP); elsewhere the keyboard
 * offers it through `autocomplete="one-time-code"`.
 */
function useCodeFromSms(onCode: (code: string) => void) {
  const receive = useEffectEvent(onCode);
  useEffect(() => {
    const controller = new AbortController();
    async function listen() {
      if (!("OTPCredential" in window)) {
        return;
      }
      try {
        const credential = await navigator.credentials.get({
          otp: { transport: ["sms"] },
          signal: controller.signal,
        });
        if (credential && "code" in credential && typeof credential.code === "string") {
          receive(credential.code);
        }
      } catch {
        // Aborted on unmount, or the user dismissed the prompt; they can still type the code.
      }
    }
    void listen();
    return () => controller.abort();
  }, []);
}

/**
 * The step after a code went out by SMS: six boxes that send themselves once full, a way to get
 * another code once the wait is over, and a way back to type a different number.
 */
export default function SmsCodeEntry({
  phone,
  onCode,
  pending,
  error,
  onResend,
  resendPending,
  onChangeNumber,
  notice,
}: {
  phone: string;
  /** Answers whether the code was accepted; a refused or failed one is cleared for the next try. */
  onCode: (code: string) => Promise<boolean>;
  pending: boolean;
  error: string | null;
  onResend: () => void;
  resendPending: boolean;
  onChangeNumber: () => void;
  /** Shown between the instruction and the boxes. */
  notice?: ReactNode;
}) {
  const [code, setCode] = useState("");
  // The host keys this component by the code sent, so it mounts when one goes out.
  const [sentAt] = useState(() => Date.now());
  const [waited, setWaited] = useState(0);

  const wait = RESEND_AFTER_SECONDS - waited;
  useEffect(() => {
    const timer = wait > 0 ? setTimeout(() => setWaited(secondsSince(sentAt)), 1000) : undefined;
    return () => clearTimeout(timer);
  }, [sentAt, wait]);

  async function submit(value: string) {
    setCode(value);
    if (!(await onCode(value).catch(() => false))) {
      setCode("");
    }
  }

  useCodeFromSms((value) => void submit(value));

  // The login page has no focus trap to read data-autofocus (a modal does). If the keyboard is
  // still up from the phone field, iOS keeps it open as focus moves here.
  const firstBox = useRef<HTMLInputElement>(null);
  // Without an id, PinInput keys its boxes by one it makes after mount, remounting them unfocused.
  const id = useId();
  useEffect(() => firstBox.current?.focus(), []);

  return (
    <Stack>
      <Text ta="center">
        Vi har sendt en engangskode på SMS til{" "}
        <Text span fw={700} style={{ whiteSpace: "nowrap" }}>
          {formatPhone(phone)}
        </Text>
        .
      </Text>
      {notice}
      <Center>
        <PinInput
          id={id}
          length={CODE_LENGTH}
          type="number"
          size="md"
          gap="xs"
          placeholder=""
          // PinInput hands its ref to the first box.
          ref={firstBox}
          getInputProps={(index) => ({ "data-autofocus": index === 0 || undefined })}
          ariaLabel="Kode fra SMS"
          value={code}
          onChange={setCode}
          onComplete={(value) => void submit(value)}
          disabled={pending}
          error={error !== null}
        />
      </Center>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <Group justify="space-between">
        <Anchor component="button" type="button" size="sm" onClick={onChangeNumber}>
          Bruk et annet nummer
        </Anchor>
        <Button
          variant="subtle"
          size="compact-sm"
          disabled={wait > 0}
          loading={resendPending}
          onClick={onResend}
        >
          {wait > 0 ? `Send ny kode om ${wait} s` : "Send ny kode"}
        </Button>
      </Group>
    </Stack>
  );
}
