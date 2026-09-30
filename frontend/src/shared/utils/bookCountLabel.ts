/** A count of books in words: "1 bok", "3 bøker". */
export function bookCountLabel(count: number): string {
  return `${count} ${count === 1 ? "bok" : "bøker"}`;
}
