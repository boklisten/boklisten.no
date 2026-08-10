export type AdminMatchListSearch = {
  runde?: string;
  fane?: "liste";
  sok?: string;
  type?: "user" | "stand";
};

export function validateAdminMatchListSearch(
  search: Record<string, unknown>,
): AdminMatchListSearch {
  return {
    runde: typeof search["runde"] === "string" ? search["runde"] : undefined,
    fane: search["fane"] === "liste" ? "liste" : undefined,
    sok: typeof search["sok"] === "string" && search["sok"] !== "" ? search["sok"] : undefined,
    type: search["type"] === "user" || search["type"] === "stand" ? search["type"] : undefined,
  };
}
