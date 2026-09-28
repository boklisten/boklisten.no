import { useMatches } from "@mantine/core";

import shortName from "@/features/customer-search/shortName";

/** Shown for a customer who has not given a name yet. */
const NO_NAME = "Uten navn";

/**
 * How a customer's name reads on this screen: only the first and last name on a phone, where the
 * full name would wrap or push its neighbours off the line, and the whole name from `sm` up.
 */
export default function useDisplayName(): (name: string | null) => string {
  const format = useMatches({ base: shortName, sm: (name: string) => name });
  return (name) => (name === null ? NO_NAME : format(name));
}
