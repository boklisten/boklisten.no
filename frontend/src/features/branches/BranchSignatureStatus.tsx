import {
  Alert,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { IconCircleCheck, IconCircleMinus, IconPencilExclamation } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import useApiClient from "@/shared/hooks/useApiClient";

const STATUS_SEGMENTS = [
  {
    key: "validSignature",
    label: "Har gyldig signatur",
    description: "Låneavtalen er signert, og signaturen er fortsatt gyldig.",
    color: "green",
    icon: <IconCircleCheck size={22} />,
  },
  {
    key: "needsSignature",
    label: "Må signere",
    description: "Har bøker eller bestillinger som krever signatur, men mangler gyldig signatur.",
    color: "orange",
    icon: <IconPencilExclamation size={22} />,
  },
  {
    key: "noSignatureNeeded",
    label: "Trenger ikke signere",
    description: "Har ingen bøker eller bestillinger som krever signatur.",
    color: "gray",
    icon: <IconCircleMinus size={22} />,
  },
] as const;

function formatPercent(count: number, total: number): string {
  if (total === 0) return "0 %";
  return `${Math.round((count / total) * 100)} %`;
}

export default function BranchSignatureStatus({ branchId }: { branchId: string }) {
  const { api } = useApiClient();
  const { data, isLoading, isError } = useQuery(
    api.branchSignatureStatus.getStatus.queryOptions({ params: { branchId } }),
  );

  if (isError) {
    return (
      <Alert color={"red"} title={"Klarte ikke hente signaturstatus"}>
        Prøv å laste siden på nytt.
      </Alert>
    );
  }

  if (isLoading || !data) {
    return (
      <Stack>
        <Skeleton h={25} w={"60%"} />
        <Skeleton h={16} />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Skeleton h={110} />
          <Skeleton h={110} />
          <Skeleton h={110} />
        </SimpleGrid>
      </Stack>
    );
  }

  if (data.totalMembers === 0) {
    return (
      <Text c={"dimmed"}>
        Ingen elever har medlemskap i denne filialen eller underliggende filialer.
      </Text>
    );
  }

  return (
    <Stack>
      <Text>
        Signaturstatus for{" "}
        <Text span fw={"bold"}>
          {data.totalMembers}
        </Text>{" "}
        {data.totalMembers === 1 ? "elev" : "elever"} i denne filialen og underliggende filialer
      </Text>
      <Progress.Root size={"xl"}>
        {STATUS_SEGMENTS.filter((segment) => data[segment.key] > 0).map((segment) => {
          const count = data[segment.key];
          return (
            <Tooltip
              key={segment.key}
              label={`${segment.label}: ${count} (${formatPercent(count, data.totalMembers)})`}
            >
              <Progress.Section value={(count / data.totalMembers) * 100} color={segment.color} />
            </Tooltip>
          );
        })}
      </Progress.Root>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {STATUS_SEGMENTS.map((segment) => {
          const count = data[segment.key];
          return (
            <Card key={segment.key} withBorder>
              <Group gap={"xs"} wrap={"nowrap"} align={"flex-start"}>
                <ThemeIcon variant={"transparent"} color={segment.color}>
                  {segment.icon}
                </ThemeIcon>
                <Stack gap={0}>
                  <Group gap={"xs"} align={"baseline"}>
                    <Text size={"xl"} fw={"bold"}>
                      {count}
                    </Text>
                    <Text size={"sm"} c={"dimmed"}>
                      {formatPercent(count, data.totalMembers)}
                    </Text>
                  </Group>
                  <Text fw={"bold"}>{segment.label}</Text>
                  <Text size={"sm"} c={"dimmed"}>
                    {segment.description}
                  </Text>
                </Stack>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
