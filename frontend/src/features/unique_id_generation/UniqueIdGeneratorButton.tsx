import { Button } from "@mantine/core";
import { IconFileDownload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification } from "@/shared/utils/notifications";
import { publicApiClient } from "@/shared/utils/publicApiClient";

export default function UniqueIdGeneratorButton() {
  const { api } = useApiClient();
  const { data, isPending, isError } = useQuery(api.uniqueIds.getToken.queryOptions());
  if (isError) {
    showErrorNotification("Klarte ikke hente autentiseringstoken for unik ID-generering");
  }
  return (
    <Button
      loading={isPending}
      component="a"
      href={
        import.meta.env["VITE_API_URL"] +
        publicApiClient.urlFor("unique_ids.download_unique_id_pdf", {
          token: data ?? "",
        })
      }
      leftSection={<IconFileDownload />}
    >
      Last ned PDF
    </Button>
  );
}
