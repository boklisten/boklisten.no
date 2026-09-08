/**
 * A name cut down for a phone screen: the first and last names whole, every name between them
 * as an initial, so "Adrian Arthur Andersen" reads "Adrian A. Andersen".
 */
export default function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) {
    return parts.join(" ");
  }
  const middle = parts.slice(1, -1).map((part) => `${part[0]?.toUpperCase() ?? ""}.`);
  return [parts[0], ...middle, parts.at(-1)].join(" ");
}
