/** The unique index a failed write collided on, or null when it failed for another reason. */
export function violatedUniqueIndex(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  return code === "23505" && typeof constraint === "string" ? constraint : null;
}
