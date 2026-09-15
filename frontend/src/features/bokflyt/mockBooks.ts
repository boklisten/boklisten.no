/**
 * The books the figures hand around: the titles Ullern's students actually pass on most often
 * at each level (staging, transfers since 2025), limited to those whose covers Nasjonalbiblioteket
 * serves today (checked 2026-09-15), so the covers load through the same lookup the product uses.
 * When the lookup fails the figures draw a plain cover with the title.
 */
export interface MockBook {
  title: string;
  isbn: string;
}

export const MOCK_BOOKS = {
  // VG1
  gripTekstenVg1: { title: "Grip teksten VG1 2020", isbn: "9788203405945" },
  fokusSamfunnskunnskap: { title: "Fokus samfunnskunnskap 2020", isbn: "9788203406782" },
  pasos: { title: "Pasos 2020", isbn: "9788203409189" },
  // VG2
  tidslinjer1: { title: "Tidslinjer 1", isbn: "9788203334047" },
  kraft1: { title: "Kraft 1 2021", isbn: "9788202694944" },
  psykologi1: { title: "Psykologi 1 2021", isbn: "9788203319471" },
  jussOgSamfunn1: { title: "Juss og samfunn 1 2021", isbn: "9788202695903" },
  fokusSosiologi: { title: "Fokus sosiologi og sosialantropologi 2021", isbn: "9788203319075" },
  // VG3
  religionOgEtikk: { title: "Religion og etikk 2022", isbn: "9788203319570" },
  gripTekstenVg3: { title: "Grip teksten VG3 2022", isbn: "9788203405990" },
  matematikkR2: { title: "Matematikk R2 2022", isbn: "9788203408892" },
  pareto2: { title: "Pareto 2 2023", isbn: "9788202740191" },
  ergo2: { title: "Ergo 2 2022", isbn: "9788203319396" },
} as const satisfies Record<string, MockBook>;
