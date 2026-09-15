import { useMutation, useQueryClient } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

export default function useUpdateBranchMutation() {
  const queryClient = useQueryClient();
  const { api } = useApiClient();

  return useMutation(
    api.branches.update.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: api.branches.index.pathKey(),
        }),
      onSuccess: () => showSuccessNotification("Filial ble oppdatert!"),
      onError: () => showErrorNotification("Klarte ikke oppdatere filial!"),
    }),
  );
}
