import { SIGNATURE_REQUIRING_CART_ITEM_TYPES } from "@boklisten/backend/shared/cart_item";
import type { CartItem } from "@boklisten/backend/shared/cart_item";
import { useSessionStorage } from "@mantine/hooks";

/**
 * An order is placed with one branch, so the cart holds one branch: a book from another branch
 * replaces everything in it. Generating a book list for a new school therefore starts over, while
 * more subjects from the same school merge in.
 */
function sameBranch(cart: CartItem[], branchId: string): CartItem[] {
  return cart.filter((cartItem) => cartItem.branchId === branchId);
}

function byTitle(cart: CartItem[]): CartItem[] {
  return cart.toSorted((a, b) => a.title.localeCompare(b.title));
}

/**
 * The customer's cart in session storage. It is read after the first render so hydration matches
 * the server; a component that never renders on the server (`use(browser())`) reads it `immediately`.
 */
export default function useCart({ immediately = false }: { immediately?: boolean } = {}) {
  const [cart, setCart, clear] = useSessionStorage<CartItem[]>({
    key: "cart",
    defaultValue: [],
    getInitialValueInEffect: !immediately,
  });
  function remove(itemId: string) {
    setCart((prev) => prev.filter((cartItem) => cartItem.id !== itemId));
  }
  /** Puts the book in the cart, replacing the line it already has there (see sameBranch). */
  function add(cartItem: CartItem) {
    setCart((prev) =>
      byTitle([
        ...sameBranch(prev, cartItem.branchId).filter((existing) => existing.id !== cartItem.id),
        cartItem,
      ]),
    );
  }
  /**
   * Puts the books that are not in the cart yet into it; a book already there keeps the way the
   * pupil chose to get it. The books are expected to come from one branch (see sameBranch).
   */
  function merge(cartItems: CartItem[]) {
    const branchId = cartItems[0]?.branchId;
    if (branchId === undefined) {
      return;
    }
    setCart((prev) => {
      const lines = new Map(sameBranch(prev, branchId).map((cartItem) => [cartItem.id, cartItem]));
      for (const cartItem of cartItems) {
        if (!lines.has(cartItem.id)) {
          lines.set(cartItem.id, cartItem);
        }
      }
      return byTitle([...lines.values()]);
    });
  }
  function getSelectedOption(cartItem: CartItem) {
    const selectedOption = cartItem.options[cartItem.selectedOptionIndex];
    if (!selectedOption) {
      clear();
      throw new Error("Invalid selected option in cart!");
    }
    return selectedOption;
  }
  function calculateTotal() {
    return Math.ceil(
      cart.reduce((total, cartItem) => total + (getSelectedOption(cartItem).price ?? 0), 0),
    );
  }
  function calculatePayLater() {
    return Math.ceil(
      cart.reduce((total, cartItem) => total + (getSelectedOption(cartItem).payLater ?? 0), 0),
    );
  }

  /** Whether ordering this cart needs a signed loan agreement: any book the customer borrows. */
  function requiresSignature() {
    return cart.some((cartItem) =>
      SIGNATURE_REQUIRING_CART_ITEM_TYPES.includes(getSelectedOption(cartItem).type),
    );
  }
  return {
    get: () => cart,
    size: () => cart.length,
    isEmpty: () => cart.length === 0,
    add,
    merge,
    remove,
    clear,
    getSelectedOption,
    calculateTotal,
    calculatePayLater,
    requiresSignature,
  };
}
