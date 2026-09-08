import { Group, Switch, TreeSelect } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import OrderDownloadsMenu from "@/features/order-manager/OrderDownloadsMenu";
import { toOrderManagerFilter } from "@/features/order-manager/orderManagerParams";
import type { OrderManagerSearchParams } from "@/features/order-manager/orderManagerParams";
import useApiClient from "@/shared/hooks/useApiClient";
import { toBranchTreeNodeData } from "@/shared/utils/branchTree";

/** What narrows the queue, and the downloads of exactly what it shows. */
export default function OrderFilters({
  params,
  onChange,
}: {
  params: OrderManagerSearchParams;
  onChange: (next: Pick<OrderManagerSearchParams, "filialer" | "bring">) => void;
}) {
  const { api } = useApiClient();
  const { data: branches } = useQuery(api.branches.getAll.queryOptions());

  return (
    <Group align="flex-end" gap="sm" wrap="wrap">
      <TreeSelect
        mode="checkbox"
        checkedStrategy="all"
        label="Filialer"
        placeholder="Alle filialer"
        nothingFoundMessage="Fant ingen filialer"
        maxDisplayedValues={3}
        maxDisplayedValuesContent={(overflow) => `+${overflow} til`}
        searchable
        clearable
        flex={{ base: "1 1 100%", sm: "1 1 280px" }}
        data={toBranchTreeNodeData(branches ?? [])}
        value={params.filialer}
        onChange={(filialer) => onChange({ filialer, bring: params.bring })}
      />
      <Switch
        label="Kun i posten"
        checked={params.bring}
        onChange={(event) =>
          onChange({ filialer: params.filialer, bring: event.currentTarget.checked })
        }
        pb={8}
      />
      <OrderDownloadsMenu filter={toOrderManagerFilter(params)} />
    </Group>
  );
}
