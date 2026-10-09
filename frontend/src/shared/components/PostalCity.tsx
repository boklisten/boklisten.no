import { useQuery } from "@tanstack/react-query";

import { postalCityQuery } from "@/shared/utils/postalCity";

/** The city of a postal code, looked up as it is shown; nothing for a code Posten does not have. */
export default function PostalCity({ postalCode }: { postalCode: string | null }) {
  return useQuery(postalCityQuery(postalCode)).data ?? null;
}
