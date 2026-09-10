/** A name cut down for a phone screen: only the first and the last, so "Adrian Arthur Andersen" reads "Adrian Andersen". */
export default function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length <= 1 ? name.trim() : `${parts[0]} ${parts.at(-1)}`;
}
