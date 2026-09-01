import type { HandoverParty } from "@boklisten/backend/shared/match/match-dto";
import { Anchor, Group, Text } from "@mantine/core";
import { IconPhone } from "@tabler/icons-react";

const OtherPersonContact = ({ party }: { party: HandoverParty }) => {
  if (party.kind === "stand") {
    return (
      <Group gap={5}>
        <Text>Boklisten sin stand</Text>
      </Group>
    );
  }

  return (
    <Group gap={5}>
      <IconPhone />
      <Text>
        {party.name}, <Anchor href={`tel:${party.phone}`}>{formatPhoneNumber(party.phone)}</Anchor>
      </Text>
    </Group>
  );
};

function formatPhoneNumber(number: string): string {
  if (/\d{8}/.exec(number) !== null) {
    return `${number.slice(0, 3)} ${number.slice(3, 5)} ${number.slice(5, 8)}`;
  }
  if (/\d{10}/.exec(number) !== null) {
    return `${number.slice(2)} ${number.slice(2, 5)} ${number.slice(5, 7)} ${number.slice(7, 10)}`;
  }
  return number;
}

export default OtherPersonContact;
