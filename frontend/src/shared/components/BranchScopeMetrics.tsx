import { Group, Skeleton, Text, ThemeIcon } from "@mantine/core";
import { IconBuildingStore, IconHierarchy3, IconUsers } from "@tabler/icons-react";
import { Activity, ReactNode } from "react";

function MetricRow({
  icon,
  color,
  label,
  value,
  isLoading,
  extra,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  value: number | undefined;
  isLoading: boolean;
  extra?: ReactNode;
}) {
  return (
    <Group gap={5}>
      <ThemeIcon variant={"transparent"} color={color} size={"md"}>
        {icon}
      </ThemeIcon>
      <Text fw={"bold"}>{label}:</Text>
      <Activity mode={isLoading ? "visible" : "hidden"}>
        <Skeleton w={"xl"} h={"md"} />
      </Activity>
      <Activity mode={value === undefined || isLoading ? "hidden" : "visible"}>
        <Text>{value}</Text>
      </Activity>
      {extra}
    </Group>
  );
}

/**
 * The three standard totals for anything counted per branch: everything in scope, this branch
 * only, and the descendants. Used by the Elever, Aktive bøker and Bestilte bøker tabs so the
 * numbers read the same way everywhere. The colors match the per-row count badges in the
 * branch-books trees: blue for this branch, grape for descendants, gray for the total.
 */
export default function BranchScopeMetrics({
  isLoading,
  total,
  direct,
  indirect,
  totalLabel = "Totalt",
  directLabel = "Denne filialen",
  indirectLabel = "Underliggende filialer",
  totalIcon,
  directExtra,
  indirectExtra,
}: {
  isLoading: boolean;
  total: number | undefined;
  direct: number | undefined;
  indirect: number | undefined;
  totalLabel?: string;
  directLabel?: string;
  indirectLabel?: string;
  totalIcon?: ReactNode;
  directExtra?: ReactNode;
  indirectExtra?: ReactNode;
}) {
  return (
    <>
      <MetricRow
        icon={totalIcon ?? <IconUsers size={18} />}
        color={"gray"}
        label={totalLabel}
        value={total}
        isLoading={isLoading}
      />
      <MetricRow
        icon={<IconBuildingStore size={18} />}
        color={"blue"}
        label={directLabel}
        value={direct}
        isLoading={isLoading}
        extra={directExtra}
      />
      <MetricRow
        icon={<IconHierarchy3 size={18} />}
        color={"grape"}
        label={indirectLabel}
        value={indirect}
        isLoading={isLoading}
        extra={indirectExtra}
      />
    </>
  );
}
