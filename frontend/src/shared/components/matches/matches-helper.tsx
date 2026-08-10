import { Title } from "@mantine/core";
import { ReactNode } from "react";

export const MatchHeader = ({ children }: { children: ReactNode }) => {
  return <Title order={2}>{children}</Title>;
};

export interface ItemStatus {
  id: string;
  title: string;
  fulfilled: boolean;
}
