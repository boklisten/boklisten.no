function prop(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

export function errorMessage(error: unknown, fallback: string) {
  const response = prop(error, "response");
  const direct = prop(response, "message");
  if (typeof direct === "string") {
    return direct;
  }
  // Error responses may arrive superjson-wrapped: { json: { message } }
  const nested = prop(prop(response, "json"), "message");
  if (typeof nested === "string") {
    return nested;
  }
  return fallback;
}
