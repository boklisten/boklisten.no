import { formatDeadline } from "@/shared/utils/deadline";

/** A cart line's date in words, "1. juli 2027", the same in the public cart and in Kasse. */
export function lineDate(to: string | undefined): string | null {
  return to ? formatDeadline(to, "D. MMMM YYYY") : null;
}

/** Whole kroner with a real minus for money that goes back: "1 400 kr", "−250 kr". */
export function signedKroner(amount: number): string {
  const kroner = `${Math.abs(Math.ceil(amount)).toLocaleString("nb-NO")} kr`;
  return amount < 0 ? `−${kroner}` : kroner;
}
