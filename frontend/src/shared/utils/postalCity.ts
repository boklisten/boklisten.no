import { queryOptions } from "@tanstack/react-query";
import validator from "validator";

import { apiClient } from "@/shared/utils/apiClient";

/**
 * The post town of a Norwegian postal code, from Posten's register. No city is stored anywhere;
 * every address shows the one its code has today. null for a code Posten does not have.
 */
export async function fetchPostalCity(postalCode: string): Promise<string | null> {
  return validator.isPostalCode(postalCode, "NO")
    ? apiClient.api.postalCodes.show({ params: { postalCode } })
    : null;
}

export function postalCityQuery(postalCode: string | null) {
  const code = postalCode?.trim() ?? "";
  return queryOptions({
    queryKey: ["postalCity", code],
    queryFn: () => fetchPostalCity(code),
    staleTime: Infinity,
  });
}
