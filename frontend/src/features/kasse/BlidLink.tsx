import type { AnchorProps } from "@mantine/core";

import { showBlid } from "@/features/kasse/kasseParams";
import EntityLink from "@/shared/components/EntityLink";

/** A book's unique ID as the way into its history in Boksøk. */
export default function BlidLink({ blid, ...props }: Omit<AnchorProps, "href"> & { blid: string }) {
  return (
    <EntityLink
      to="/admin/kasse"
      search={showBlid(blid)}
      size="sm"
      ff="monospace"
      aria-label={`Se historikken til bok ${blid}`}
      {...props}
    >
      {blid}
    </EntityLink>
  );
}
