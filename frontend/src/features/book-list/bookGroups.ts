import type { OrderItemType } from "@boklisten/backend/shared/order/order-item/order-item-type";

import { formatDeadline, isOverdue } from "@/shared/utils/deadline";

/** What a book contributes to its group: when it is due, how it is held, and where it is from. */
export interface BookGroupKey {
  /** The books' type when they all share one; null when the group mixes types. */
  type: OrderItemType | null;
  /** `YYYY-MM-DD`; null on a purchase, which is never due back. */
  deadline: string | null;
  /** Null while the branch's name is not known yet. */
  branchName: string | null;
}

export interface BookGroupData<Book> extends Omit<BookGroupKey, "branchName"> {
  key: string;
  /** Every branch the group's books are from, in order of appearance; usually just one. */
  branchNames: string[];
  books: Book[];
}

/**
 * Books grouped by deadline, soonest first. A customer usually has one deadline, sometimes one
 * per term, so the date is said once in the header together with the branch. A school's year
 * groups are branches of their own, so a group may span several; the header names them all
 * rather than splitting one term's books into a group per branch.
 */
export function groupBooks<Book>(
  books: Book[],
  keyOf: (book: Book) => BookGroupKey,
): BookGroupData<Book>[] {
  const groups = new Map<string, BookGroupData<Book>>();
  for (const book of books) {
    const { type, deadline, branchName } = keyOf(book);
    const key = deadline ?? "-";
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {
        key,
        type,
        deadline,
        branchNames: branchName === null ? [] : [branchName],
        books: [book],
      });
      continue;
    }
    group.books.push(book);
    if (group.type !== type) {
      group.type = null;
    }
    if (branchName !== null && !group.branchNames.includes(branchName)) {
      group.branchNames.push(branchName);
    }
  }
  return [...groups.values()].toSorted((a, b) =>
    (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"),
  );
}

const PERIOD_LABELS: Partial<Record<OrderItemType, string>> = {
  rent: "Lån",
  "partly-payment": "Delbetaling",
  "match-receive": "Lån",
};

/** "Lån til 20.12.2026", "Delbetaling til …", "Kjøp", or "Frist …" for a group of mixed types. */
export function periodLabel({ type, deadline }: Pick<BookGroupKey, "type" | "deadline">): string {
  if (type === "buy") {
    return "Kjøp";
  }
  const label = type ? PERIOD_LABELS[type] : undefined;
  if (deadline === null) {
    return label ?? "Uten frist";
  }
  const date = formatDeadline(deadline, "DD.MM.YYYY");
  return label === undefined ? `Frist ${date}` : `${label} til ${date}`;
}

/** Whether a group of books still held is past its deadline. */
export function groupIsOverdue(group: Pick<BookGroupKey, "deadline">, held: boolean): boolean {
  return held && group.deadline !== null && isOverdue(group.deadline);
}
