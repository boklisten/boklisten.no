import { Button, type ButtonProps } from "@mantine/core";
import { IconLockOpen } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function UnlockUserMatchesButton({
  userDetailId,
  variant,
  size,
}: {
  userDetailId: string;
} & Pick<ButtonProps, "variant" | "size">) {
  const { client } = useApiClient();
  const unlockUserMatchesMutation = useMutation({
    mutationFn: async () =>
      client.api.matches.lock({
        body: {
          customerId: userDetailId,
          userMatchesLocked: false,
        },
      }),
    onSuccess: () => showSuccessNotification("Overleveringene ble låst opp!"),
    onError: () => showErrorNotification("Klarte ikke låse opp overleveringene"),
  });

  return (
    <Button
      variant={variant}
      size={size}
      leftSection={<IconLockOpen size={18} aria-hidden />}
      onClick={() => unlockUserMatchesMutation.mutate()}
      loading={unlockUserMatchesMutation.isPending}
    >
      Lås opp overleveringer
    </Button>
  );
}
