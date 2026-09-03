export default function bookCountLabel(count: number): string {
  return `${count} ${count === 1 ? "bok" : "bøker"}`;
}
