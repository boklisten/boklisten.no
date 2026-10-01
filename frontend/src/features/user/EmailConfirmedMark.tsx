import { Tooltip } from "@mantine/core";
import { IconCheck, IconInfoCircleFilled } from "@tabler/icons-react";

/** Whether the address in an email field is confirmed, at the field's end. */
export default function EmailConfirmedMark({ confirmed }: { confirmed: boolean }) {
  return (
    <Tooltip label={confirmed ? "Bekreftet" : "Ikke bekreftet"}>
      {confirmed ? <IconCheck color="green" /> : <IconInfoCircleFilled color="orange" />}
    </Tooltip>
  );
}
