const SEPARATOR = /[ -]/gu;

/**
 * Normalises free-text user input such as names and addresses: coalesces
 * whitespace, collapses runs of separators (space/hyphen) to the first one,
 * drops leading/trailing separators and title-cases every word.
 */
export function cleanUserInput(dirtyText: string) {
  const collapsedSeparators = dirtyText
    .replaceAll(/\s+/gu, " ")
    .replaceAll(/(?<separator>[ -])[ -]+/gu, "$<separator>")
    .replaceAll(/^[ -]+|[ -]+$/gu, "");
  const separators = collapsedSeparators.match(SEPARATOR) ?? [];
  return collapsedSeparators
    .split(SEPARATOR)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .map((word, index) => word + (separators[index] ?? ""))
    .join("");
}
