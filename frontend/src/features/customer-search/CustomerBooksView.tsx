import type { User } from "@boklisten/backend/shared/user";

import BookOverview from "@/features/book-list/BookOverview";
import HeldBookList, { useHeldBooks } from "@/features/customer-search/HeldBookList";
import HandoutBooksList from "@/features/customer-search/HandoutBooksList";
import { useHandoutRows } from "@/features/customer-search/useHandoutRows";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";

/**
 * Every book in the customer's hands or on its way, at the stand: what is to be handed out now,
 * and what the customer has, a book going through an overlevering marked on its row. The same
 * overview the customer sees on their own page, with the stand's rows and actions.
 */
export default function CustomerBooksView({ customer }: { customer: User }) {
  const { loaded, rows, refreshOrders } = useHandoutRows(customer);
  const held = useHeldBooks(customer.id);

  return (
    <BookOverview
      audience="employee"
      ordered={{
        count: loaded ? rows.length : undefined,
        content: (
          <HandoutBooksList customerId={customer.id} rows={rows} onChanged={refreshOrders} />
        ),
      }}
      held={
        held.isError
          ? { count: 1, content: <ErrorAlert>Klarte ikke laste inn kundens bøker.</ErrorAlert> }
          : {
              count: held.books?.length,
              content: held.books && (
                <HeldBookList
                  customerId={customer.id}
                  books={held.books}
                  deliverTo={held.deliverTo}
                />
              ),
            }
      }
    />
  );
}
