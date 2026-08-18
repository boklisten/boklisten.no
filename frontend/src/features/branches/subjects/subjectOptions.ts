export const PAYMENT_OPTIONS = [
  { value: "rent", label: "Leie" },
  { value: "partlyPayment", label: "Delbetaling" },
  { value: "buy", label: "Salg" },
] as const;

export interface SubjectBookFlags {
  rent: boolean;
  partlyPayment: boolean;
  buy: boolean;
  rentAtBranch: boolean;
  partlyPaymentAtBranch: boolean;
  buyAtBranch: boolean;
}

export interface BranchSubjectBook extends SubjectBookFlags {
  item: { id: string; title: string };
}

export interface BranchSubject {
  id: number;
  name: string;
  externalName: string;
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

export function describeOptions(flags: SubjectBookFlags) {
  const describe = (values: string[]) =>
    PAYMENT_OPTIONS.filter((option) => values.includes(option.value))
      .map((option) => option.label)
      .join(" · ") || "Ingen";
  const formValue = bookToFormValue({ ...flags, item: { id: "", title: "" } });
  return {
    ordering: describe(formValue.ordering),
    atBranch: describe(formValue.atBranch),
  };
}
