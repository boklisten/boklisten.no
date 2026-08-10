import { Group, Stack, Text } from "@mantine/core";
import { IconClock, IconMapPin } from "@tabler/icons-react";

import { FormattedDatetime } from "@/features/matches/matchesList/helper";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

const MeetingInfo = ({
  meetingTime,
  meetingLocation,
}: {
  meetingTime: string | null;
  meetingLocation: string;
}) => {
  return (
    <Stack gap={"xs"}>
      <Group gap={5}>
        <IconClock />
        {(meetingTime && <FormattedDatetime date={new Date(meetingTime)} />) || (
          <Text>
            Du kan møte opp når standen vår er åpen.{" "}
            <TanStackAnchor to="/info/branch">Se åpningstider her</TanStackAnchor>
          </Text>
        )}
      </Group>
      <Group gap={5}>
        <IconMapPin />
        <Text>{meetingLocation}</Text>
      </Group>
    </Stack>
  );
};

export default MeetingInfo;
