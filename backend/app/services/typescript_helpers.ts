export function isNullish(maybeNullish: unknown): maybeNullish is undefined | null {
  return maybeNullish == null;
}

export function isNotNullish<T>(maybeNullish: T | undefined | null): maybeNullish is T {
  return maybeNullish != null;
}

export function isBoolean(maybeBoolean: unknown): maybeBoolean is boolean {
  return typeof maybeBoolean === "boolean";
}

export function isNumber(maybeNumber: unknown): maybeNumber is number {
  return typeof maybeNumber === "number";
}
