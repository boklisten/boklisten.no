import { useMatches } from "@mantine/core";

import shortName from "@/features/customer-search/shortName";

/**
 * How a customer's name reads on this screen: only the first and last name on a phone, where the
 * full name would wrap or push its neighbours off the line, and the whole name from `sm` up.
 */
export default function useDisplayName(): (name: string) => string {
  return useMatches({ base: shortName, sm: (name: string) => name });
}
