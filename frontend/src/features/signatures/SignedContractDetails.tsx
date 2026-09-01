import { Group, Stack, Text } from "@mantine/core";

import SuccessAlert from "@/shared/components/alerts/SuccessAlert";

export default function SignedContractDetails({
  signedByGuardian,
  signingName,
  name,
  signedAtText,
  expiresAtText,
}: {
  signedByGuardian: boolean;
  signingName: string;
  name: string;
  signedAtText: string;
  expiresAtText: string;
}) {
  return (
    <SuccessAlert title="Kontrakten er signert">
      <Stack gap="xs">
        <Text>
          {signedByGuardian
            ? `${signingName} (foresatt) har signert kontrakten på vegne av ${name} (elev).`
            : `${name} (elev) har signert kontrakten.`}
        </Text>
        <Group gap={5}>
          <Text>Signert:</Text>
          <Text fw="bold">{signedAtText}</Text>
        </Group>
        <Group gap={5}>
          <Text>Gyldig til:</Text>
          <Text fw="bold">{expiresAtText}</Text>
        </Group>
        {signedByGuardian && (
          <Text fs="italic" size="sm">
            Merk: Når {name} fyller 18 år, må avtalen signeres på nytt av eleven selv.
          </Text>
        )}
      </Stack>
    </SuccessAlert>
  );
}
