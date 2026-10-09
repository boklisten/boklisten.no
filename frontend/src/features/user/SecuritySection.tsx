import type { User } from "@boklisten/backend/shared/user";
import { Group, Stack, Switch, Text } from "@mantine/core";
import { IconCircleCheckFilled } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import type { ReactNode } from "react";

import { authQueryKey } from "@/features/auth/authQuery";
import VippsWordmark, { VIPPS_ORANGE } from "@/features/auth/VippsWordmark";
import FormSectionTitle from "@/features/user/FormSectionTitle";
import { api } from "@/shared/utils/apiClient";
import { notifySaved, notifySaveFailed } from "@/shared/hooks/useAutoSave";

/**
 * How the user logs in. Without Vipps they are told how to connect it; with Vipps they may turn
 * SMS login off, so nobody can send codes to their number or guess at them. Turning it off needs
 * Vipps, or they could not log in again.
 */
export default function SecuritySection({ user }: { user: User }) {
  return (
    <Stack gap="sm">
      <FormSectionTitle>Sikkerhet</FormSectionTitle>
      {user.vippsLinked ? <VippsConnected user={user} /> : <VippsNotConnected />}
    </Stack>
  );
}

/** The Vipps wordmark on a light Vipps-orange panel, with the status or action beside it. */
function VippsPanel({ children }: { children: ReactNode }) {
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      px="md"
      py="sm"
      style={{
        borderRadius: "var(--mantine-radius-md)",
        background: `color-mix(in srgb, ${VIPPS_ORANGE} 8%, transparent)`,
        color: VIPPS_ORANGE,
      }}
    >
      <VippsWordmark height={18} />
      {children}
    </Group>
  );
}

/** No connect-while-logged-in on purpose: a Vipps login always lands in its own account. */
function VippsNotConnected() {
  return (
    <>
      <VippsPanel>
        <Text size="sm" c="dimmed">
          Ikke koblet til
        </Text>
      </VippsPanel>
      <Text size="sm" c="dimmed">
        Velg Vipps neste gang du logger inn for å koble til.
      </Text>
    </>
  );
}

function VippsConnected({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const toastId = useId();
  const setSmsLogin = useMutation(
    api.users.setSmsLogin.mutationOptions({
      // Saved at once, like the auto-saved details above, so it tells the user the same way.
      onSuccess: () => notifySaved(toastId),
      onError: notifySaveFailed,
      onSettled: () => queryClient.invalidateQueries({ queryKey: authQueryKey() }),
    }),
  );
  return (
    <>
      <VippsPanel>
        <Group gap={6} wrap="nowrap">
          <IconCircleCheckFilled size={18} color="var(--mantine-color-teal-6)" />
          <Text size="sm" fw={600} c="var(--mantine-color-text)">
            Koblet til
          </Text>
        </Group>
      </VippsPanel>
      <Switch
        label="Tillat innlogging med SMS"
        checked={user.smsLoginEnabled}
        disabled={setSmsLogin.isPending}
        onChange={(event) => setSmsLogin.mutate({ body: { enabled: event.currentTarget.checked } })}
      />
    </>
  );
}
