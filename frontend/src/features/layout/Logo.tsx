import { Group, Title } from "@mantine/core";
import { Image } from "@unpic/react";

import TestVersionChip from "@/features/layout/TestVersionChip";
import TanStackAnchor from "@/shared/components/TanStackAnchor";

export default function Logo({ variant, admin }: { variant: "white" | "blue"; admin?: boolean }) {
  return (
    <TanStackAnchor to={admin ? "/admin" : "/"} underline={"never"}>
      <Group gap={"xs"} wrap={"nowrap"}>
        <Image
          src={`/images/boklisten_logo_${variant}.png`}
          width={40}
          height={40}
          alt="Boklisten.no"
        />
        <Title
          style={{ fontFamily: "serif" }}
          order={2}
          c={variant === "white" ? "#fff" : "#26768f"}
          textWrap={"nowrap"}
        >
          {admin ? "bl-admin" : "Boklisten.no"}
        </Title>
        <TestVersionChip />
      </Group>
    </TanStackAnchor>
  );
}
