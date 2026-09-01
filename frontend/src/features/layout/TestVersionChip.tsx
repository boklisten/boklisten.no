import { Badge, Tooltip } from "@mantine/core";

import { getEnv, isProduction } from "@/shared/utils/env";

export default function TestVersionChip() {
  if (isProduction()) {
    return null;
  }
  const env = getEnv();

  return (
    <Tooltip
      multiline
      label="Dette er en test-versjon av Boklisten.no, koblet til en test-database, som tilbakestilles hver natt. Endringer og ordre er derfor IKKE permanente her."
    >
      <Badge variant="gradient" gradient={{ from: "orange", to: "yellow", deg: 90 }}>
        {env}
      </Badge>
    </Tooltip>
  );
}
