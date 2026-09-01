import { Alert } from "@mantine/core";
import type { AlertProps } from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";

export default function SuccessAlert(props: AlertProps) {
  return (
    <Alert icon={<IconCircleCheck />} color="green" {...props}>
      {props.children}
    </Alert>
  );
}
