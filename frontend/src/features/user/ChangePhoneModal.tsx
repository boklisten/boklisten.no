import { Modal } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { codeRequestErrorText } from "@/features/auth/codeRequestError";
import SmsCodeEntry from "@/features/auth/SmsCodeEntry";
import SmsPhoneForm from "@/features/auth/SmsPhoneForm";
import { api } from "@/shared/utils/apiClient";
import { showSuccessNotification } from "@/shared/utils/notifications";

/**
 * The phone is what the customer logs in with, so a new number takes effect only once a code
 * sent to it comes back. The modal unmounts when closed, so it always starts over.
 */
export default function ChangePhoneModal({
  opened,
  onClose,
  onChanged,
}: {
  opened: boolean;
  onClose: () => void;
  onChanged: (phone: string) => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Endre mobilnummer" centered>
      {opened && <ChangePhoneSteps onClose={onClose} onChanged={onChanged} />}
    </Modal>
  );
}

function ChangePhoneSteps({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: (phone: string) => void;
}) {
  // `sends` counts the codes sent to the number, so a new one restarts the code entry.
  const [sent, setSent] = useState<{ phone: string; sends: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendMutation = useMutation(
    api.users.sendPhoneChangeCode.mutationOptions({
      onMutate: () => setError(null),
      onSuccess: (response, { body: { phone } }) => {
        if (response.message) {
          setError(response.message);
          return;
        }
        setSent((previous) => ({
          phone,
          sends: previous?.phone === phone ? previous.sends + 1 : 1,
        }));
      },
      onError: (sendError) => setError(codeRequestErrorText(sendError)),
    }),
  );
  const changeMutation = useMutation(
    api.users.changeMyPhone.mutationOptions({
      onMutate: () => setError(null),
      onError: (changeError) => setError(codeRequestErrorText(changeError)),
    }),
  );

  if (sent) {
    const { phone } = sent;
    return (
      <SmsCodeEntry
        key={sent.sends}
        phone={phone}
        pending={changeMutation.isPending}
        error={error}
        resendPending={sendMutation.isPending}
        onResend={() => sendMutation.mutate({ body: { phone } })}
        onChangeNumber={() => {
          setError(null);
          setSent(null);
        }}
        onCode={async (code) => {
          const response = await changeMutation.mutateAsync({ body: { phone, code } });
          if (response.message) {
            setError(response.message);
            return false;
          }
          onChanged(phone);
          showSuccessNotification("Mobilnummeret er endret");
          onClose();
          return true;
        }}
      />
    );
  }

  return (
    <SmsPhoneForm
      label="Nytt mobilnummer"
      focusFirst
      error={error}
      pending={sendMutation.isPending}
      onSend={(phone) => sendMutation.mutate({ body: { phone } })}
    />
  );
}
