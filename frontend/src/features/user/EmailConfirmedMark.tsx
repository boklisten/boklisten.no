import { Tooltip } from "@mantine/core";
import { IconCheck, IconInfoCircleFilled } from "@tabler/icons-react";

/** Whether the address in an email field is confirmed, at the field's end. */
export default function EmailConfirmedMark({ confirmed }: { confirmed: boolean }) {
  return (
    <Tooltip label={confirmed ? "Bekreftet" : "Ikke bekreftet"}>
      {confirmed ? (
        <IconCheck color="var(--mantine-color-green-filled)" />
      ) : (
        <IconInfoCircleFilled color="var(--mantine-color-orange-filled)" />
      )}
    </Tooltip>
  );
}
