import type { UserDetail } from "@boklisten/backend/shared/user-detail";
import { Button, Stack, Text } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import WarningAlert from "@/shared/components/alerts/WarningAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { errorMessage } from "@/shared/utils/errorMessage";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function EmailConfirmationWarning({ customer }: { customer: UserDetail }) {
  const { api } = useApiClient();
  const queryClient = useQueryClient();

  const confirmEmailMutation = useMutation(
    api.userDetail.confirmEmail.mutationOptions({
      onSuccess: () => showSuccessNotification("E-postadressen ble bekreftet"),
      onError: (error) =>
        showErrorNotification(errorMessage(error, "Klarte ikke bekrefte e-postadressen")),
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.userDetail.getById.queryKey({ params: { detailsId: customer.id } }),
        }),
    }),
  );

  if (customer.emailConfirmed) {
    return null;
  }

  return (
    <WarningAlert title={"E-postadressen er ikke bekreftet"}>
      <Stack gap={"xs"} align={"flex-start"}>
        <Text size={"sm"}>
          Spør kunden om{" "}
          <Text span fw={700} style={{ overflowWrap: "anywhere" }}>
            {customer.email}
          </Text>{" "}
          er riktig e-post. Er den feil, kan du endre den med{" "}
          <IconPencil
            size={16}
            aria-label={"Rediger brukerdetaljer"}
            style={{ verticalAlign: "text-bottom" }}
          />
        </Text>
        <Button
          color={"yellow"}
          variant={"filled"}
          loading={confirmEmailMutation.isPending}
          onClick={() => confirmEmailMutation.mutate({ params: { detailsId: customer.id } })}
        >
          Bekreft e-postadressen
        </Button>
      </Stack>
    </WarningAlert>
  );
}
