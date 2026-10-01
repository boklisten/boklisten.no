import { Group } from "@mantine/core";
import { Image } from "@unpic/react";

import classes from "@/features/layout/Logo.module.css";
import TestVersionChip from "@/features/layout/TestVersionChip";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

export default function Logo({ variant, admin }: { variant: "white" | "blue"; admin?: boolean }) {
  return (
    // Exact, or the router marks the logo as the current page everywhere below the home.
    <TanStackAnchor to={admin ? "/admin" : "/"} activeOptions={{ exact: true }} underline="never">
      <Group gap="xs" wrap="nowrap">
        <Image
          src={`/images/boklisten_logo_${variant}.webp`}
          width={40}
          height={40}
          alt="Boklisten.no"
        />
        <span className={classes.wordmark} data-variant={variant}>
          {admin ? "bl-admin" : "Boklisten.no"}
        </span>
        <TestVersionChip />
      </Group>
    </TanStackAnchor>
  );
}
