import { Badge, Title } from "@mantine/core";
import { IconUsers } from "@tabler/icons-react";
import { ReactNode } from "react";

export const MatchHeader = ({ children }: { children: ReactNode }) => {
  return <Title order={2}>{children}</Title>;
};

/** Marks a book that moves between two students rather than over the counter. */
export function PeerBadge({ children }: { children: ReactNode }) {
  return (
    <Badge
      variant={"light"}
      color={"blue"}
      tt={"none"}
      leftSection={<IconUsers size={12} />}
      // Student names must survive 375px, so the label wraps instead of truncating
      styles={{
        root: { height: "auto" },
        label: { whiteSpace: "normal", lineHeight: 1.3 },
      }}
    >
      {children}
    </Badge>
  );
}

export interface ItemStatus {
  /** Item id; suffixed with the copy's blid for extra copies handed out without an order. */
  id: string;
  title: string;
  fulfilled: boolean;
  /**
   * Set when the customer is due to get this book from another student rather than over the
   * counter: the name of that student. Rows without it are ordinary stand handouts.
   */
  receiveFromName?: string;
}
