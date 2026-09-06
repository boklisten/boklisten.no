import type { AdminPage } from "@/features/layout/adminNavigation";

/** Lowercase without diacritics, so "pamin" finds "Påminnelser" and "boker" finds "Bøker". */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .replaceAll("ø", "o")
    .replaceAll("æ", "ae")
    .toLowerCase();

/**
 * Pages matching the query, best first: title starts with it, then title contains it, then
 * description contains it. Order within each tier is the sidebar order, which the user already
 * knows.
 */
export function searchPages(pages: AdminPage[], query: string): AdminPage[] {
  const term = normalize(query.trim());
  if (term.length === 0) {
    return [];
  }
  const tiers: ((page: AdminPage) => boolean)[] = [
    (page) => normalize(page.label).startsWith(term),
    (page) => normalize(page.label).includes(term),
    (page) => normalize(page.description).includes(term),
  ];
  const ranked: AdminPage[] = [];
  for (const matches of tiers) {
    for (const page of pages) {
      if (!ranked.includes(page) && matches(page)) {
        ranked.push(page);
      }
    }
  }
  return ranked;
}
