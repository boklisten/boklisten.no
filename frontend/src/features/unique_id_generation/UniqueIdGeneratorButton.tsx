import { Button } from "@mantine/core";
import { IconFileDownload } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { showErrorNotification } from "@/shared/utils/notifications";
import { api, apiClient } from "@/shared/utils/apiClient";
import { API_URL } from "@/shared/utils/env";

export default function UniqueIdGeneratorButton() {
  const { data, isPending, isError } = useQuery(api.uniqueIds.token.queryOptions());
  if (isError) {
    showErrorNotification("Klarte ikke hente autentiseringstoken for unik ID-generering");
  }
  return (
    <Button
      loading={isPending}
      component="a"
      href={
        API_URL +
        apiClient.urlFor("unique_ids.pdf", {
          token: data ?? "",
        })
      }
      leftSection={<IconFileDownload />}
    >
      Last ned PDF
    </Button>
  );
}
