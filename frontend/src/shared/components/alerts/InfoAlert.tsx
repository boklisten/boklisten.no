import { Alert } from "@mantine/core";
import type { AlertProps } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";

export default function InfoAlert(props: AlertProps) {
  return (
    <Alert icon={<IconInfoCircle />} {...props}>
      {props.children}
    </Alert>
  );
}
