import type { AnchorProps } from "@mantine/core";
import type { MouseEventHandler, ReactNode } from "react";

import { showCustomer } from "@/features/kasse/kasseParams";
import EntityLink from "@/shared/components/EntityLink";

/**
 * A customer's name as the way into their Kasse view. Every admin page that prints a student's
 * name uses this, so the name reads and behaves the same everywhere.
 */
export default function CustomerLink({
  detailsId,
  children,
  ...props
}: Omit<AnchorProps, "href"> & {
  detailsId: string;
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  "aria-label"?: string;
}) {
  return (
    <EntityLink
      to="/admin/kasse"
      search={showCustomer(detailsId)}
      // `inherit` alone leaves the standard weight in place; inside a badge or heading the name
      // should weigh exactly what its neighbours do
      {...(props.inherit ? { fw: "inherit" } : {})}
      {...props}
    >
      {children}
    </EntityLink>
  );
}
