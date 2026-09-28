/**
 * The Overleveringer tab's state on the branch page. Every name starts with `runde` or names the
 * match, because TanStack unions search params across routes and the branch page already owns
 * `filial` and `filialFane`.
 */
export interface BranchRoundsSearch {
  runde?: string;
  rundeFane?: "liste";
  rundeSok?: string;
  rundeType?: "user" | "stand";
  /** An open match detail, shown in place of the list. */
  overlevering?: string;
}

const nonEmptyString = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : undefined;

export function validateBranchRoundsSearch(search: Record<string, unknown>): BranchRoundsSearch {
  return {
    runde: nonEmptyString(search["runde"]),
    rundeFane: search["rundeFane"] === "liste" ? "liste" : undefined,
    rundeSok: nonEmptyString(search["rundeSok"]),
    rundeType:
      search["rundeType"] === "user" || search["rundeType"] === "stand"
        ? search["rundeType"]
        : undefined,
    overlevering: nonEmptyString(search["overlevering"]),
  };
}
