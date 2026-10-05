import { Button } from "@mantine/core";
import { IconFileDownload } from "@tabler/icons-react";

import { apiClient } from "@/shared/utils/apiClient";
import { API_URL } from "@/shared/utils/env";

export default function UniqueIdGeneratorButton() {
  return (
    <Button
      component="a"
      href={API_URL + apiClient.urlFor("unique_ids.pdf")}
      leftSection={<IconFileDownload />}
    >
      Last ned PDF
    </Button>
  );
}
