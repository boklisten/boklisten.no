import { Alert } from "@mantine/core";
import type { AlertProps } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

export default function WarningAlert(props: AlertProps) {
  return (
    <Alert icon={<IconAlertTriangle />} color="yellow" {...props}>
      {props.children}
    </Alert>
  );
}
