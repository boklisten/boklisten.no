import { Group, Skeleton } from "@mantine/core";
import { IconMapPin } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { api } from "@/shared/utils/apiClient";

export default function BranchLocationInfo({ branchId }: { branchId: string }) {
  const {
    data: branch,
    isLoading,
    isError,
  } = useQuery(api.branches.show.queryOptions({ params: { branchId } }));
  if (isLoading) {
    return <Skeleton width={250} height={25} />;
  }
  if (isError) {
    return <ErrorAlert title="Klarte ikke laste inn addresse" />;
  }

  return (
    <Group gap={5}>
      <IconMapPin />
      {branch?.address ?? "Ukjent"}
    </Group>
  );
}
