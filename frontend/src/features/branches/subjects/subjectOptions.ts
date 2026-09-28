export const PAYMENT_OPTIONS = [
  { value: "rent", label: "Lån" },
  { value: "partlyPayment", label: "Delbetaling" },
  { value: "buy", label: "Salg" },
] as const;

interface SubjectBookFlags {
  rent: boolean;
  partlyPayment: boolean;
  buy: boolean;
  rentAtBranch: boolean;
  partlyPaymentAtBranch: boolean;
  buyAtBranch: boolean;
}

interface BranchSubjectBook extends SubjectBookFlags {
  item: { id: string; title: string };
}

export interface BranchSubject {
  id: number;
  name: string;
  externalName: string | null;
  books: BranchSubjectBook[];
}

/** A book in the editor form: the six flags represented as two chip selections */
export interface SubjectBookFormValue {
  item: { id: string; title: string };
  ordering: string[];
  atBranch: string[];
}

export function bookToFormValue(book: BranchSubjectBook): SubjectBookFormValue {
  return {
    item: book.item,
    ordering: PAYMENT_OPTIONS.map((option) => option.value).filter((value) => book[value]),
    atBranch: PAYMENT_OPTIONS.map((option) => option.value).filter(
      (value) => book[`${value}AtBranch`],
    ),
  };
}

export function formValueToBook(book: SubjectBookFormValue) {
  return {
    itemId: book.item.id,
    rent: book.ordering.includes("rent"),
    partlyPayment: book.ordering.includes("partlyPayment"),
    buy: book.ordering.includes("buy"),
    rentAtBranch: book.atBranch.includes("rent"),
    partlyPaymentAtBranch: book.atBranch.includes("partlyPayment"),
    buyAtBranch: book.atBranch.includes("buy"),
  };
}
