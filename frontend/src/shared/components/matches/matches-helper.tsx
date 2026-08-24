import { Title } from "@mantine/core";
import { ReactNode } from "react";

export const MatchHeader = ({ children }: { children: ReactNode }) => {
  return <Title order={2}>{children}</Title>;
};

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
