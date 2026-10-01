import { Divider, Stack, Title } from "@mantine/core";
import type { ReactNode } from "react";

/** A section of a user form: a small title over a hairline, as "Din informasjon" opens the details. */
export default function FormSectionTitle({
  id,
  children,
}: {
  /** For a control the title names, through `aria-labelledby`. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <Stack gap={3}>
      <Title order={4} id={id}>
        {children}
      </Title>
      <Divider />
    </Stack>
  );
}
