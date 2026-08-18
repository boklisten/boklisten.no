export function errorMessage(error: unknown, fallback: string) {
  const response = (error as { response?: unknown } | null)?.response;
  const direct = (response as { message?: unknown } | null)?.message;
  if (typeof direct === "string") return direct;
  // Error responses may arrive superjson-wrapped: { json: { message } }
  const nested = (response as { json?: { message?: unknown } } | null)?.json?.message;
  if (typeof nested === "string") return nested;
  return fallback;
}
