import type { CartItem, CartItemOption } from "@boklisten/backend/shared/cart_item";
import { Skeleton } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { use } from "react";
import { browser } from "react-dom";

import classes from "@/features/cart/cart.module.css";
import CartBar from "@/features/cart/CartBar";
import CartEmpty from "@/features/cart/CartEmpty";
import CartLine from "@/features/cart/CartLine";
import PartlyPaymentNote from "@/features/cart/PartlyPaymentNote";
import useCartConflicts from "@/features/cart/useCartConflicts";
import type { CartConflict } from "@/features/cart/useCartConflicts";
import { nodeById } from "@/features/branch-walk/branchTree";
import BranchWalkHeader from "@/features/branch-walk/BranchWalkHeader";
import { ORDER_WALK, orderTreeOptions } from "@/features/order/orderTree";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useAuth from "@/shared/hooks/useAuth";
import useCart from "@/shared/hooks/useCart";

/** Lines that came from Dine bøker carry no subject; they sit together after the subjects. */
const OWN_BOOKS = "Dine bøker";

interface Line {
  cartItem: CartItem;
  selected: CartItemOption;
  conflict: CartConflict | null;
}

/** The page's header and lines while the cart is still only in the browser's storage. */
export function CartPending() {
  return (
    <>
      <CartHeader />
      <div className={classes.skeletons} aria-busy>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} h={104} radius="lg" />
        ))}
      </div>
    </>
  );
}

/** The last step of the order flow keeps the flow's header. */
function CartHeader() {
  return <BranchWalkHeader walk={ORDER_WALK} path={[]} title="Handlekurv" />;
}

/** The cart lives in the browser, so the page renders there and shows its skeleton on the server. */
export default function CartContent() {
  use(browser());
  const cart = useCart({ immediately: true });
  const { isLoggedIn } = useAuth();
  const conflictOf = useCartConflicts();
  const branchId = cart.get()[0]?.branchId;
  const { data: tree } = useQuery({ ...orderTreeOptions(), enabled: branchId !== undefined });
  const branch = tree && branchId ? nodeById(tree, branchId) : undefined;

  if (cart.isEmpty()) {
    return <CartEmpty />;
  }

  // Titles are already in order within the cart, so grouping keeps them in order within a section
  const lines: Line[] = cart.get().map((cartItem) => {
    const selected = cart.getSelectedOption(cartItem);
    return { cartItem, selected, conflict: conflictOf(cartItem, selected) };
  });
  const sections = [...Map.groupBy(lines, (line) => line.cartItem.subject ?? OWN_BOOKS)].toSorted(
    ([a], [b]) => sectionOrder(a, b),
  );
  const conflicting = lines.filter((line) => line.conflict !== null);
  const partlyPayments = lines
    .map((line) => line.selected)
    .filter((option) => option.type === "partly-payment");
  // Nothing to pay at all: no prices anywhere, and the order is placed straight from the cart. A
  // cart that mixes a free loan with a paid line still prices every line, the loan at 0 kr.
  const total = cart.calculateTotal();
  const payLater = cart.calculatePayLater();
  const free = total === 0 && payLater === 0;

  return (
    <div className={classes.root}>
      <CartHeader />
      <div className={classes.sections}>
        {sections.map(([section, sectionLines]) => (
          <section key={section} className={classes.section}>
            {sections.length > 1 && <h2 className={classes.sectionLabel}>{section}</h2>}
            <ul className={classes.lines}>
              {sectionLines.map(({ cartItem, selected, conflict }) => (
                <CartLine
                  key={cartItem.id}
                  cartItem={cartItem}
                  selected={selected}
                  conflict={conflict}
                  showPrice={!free}
                  onSelect={(selectedOptionIndex) => cart.add({ ...cartItem, selectedOptionIndex })}
                  onRemove={() => cart.remove(cartItem.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className={classes.after}>
        {branch && (
          <TanStackAnchor
            to="/bestilling/$branchId"
            params={{ branchId: branch.id }}
            className={classes.addMore}
            underline="hover"
          >
            <IconPlus size={18} aria-hidden />
            Legg til flere bøker
          </TanStackAnchor>
        )}
        {partlyPayments.length > 0 && <PartlyPaymentNote options={partlyPayments} />}
      </div>
      <CartBar
        count={lines.length}
        total={total}
        payLater={payLater}
        conflictCount={conflicting.length}
        isLoggedIn={isLoggedIn}
        onRemoveConflicts={() => {
          for (const line of conflicting) {
            cart.remove(line.cartItem.id);
          }
        }}
      />
    </div>
  );
}

/** Subjects alphabetically, the pupil's own books last. */
function sectionOrder(a: string, b: string): number {
  if (a === OWN_BOOKS || b === OWN_BOOKS) {
    return a === b ? 0 : a === OWN_BOOKS ? 1 : -1;
  }
  return a.localeCompare(b, "nb");
}
