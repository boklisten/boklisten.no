import type { CartItem, CartItemOption } from "@boklisten/backend/shared/cart_item";
import type { OrderItemType } from "@boklisten/backend/shared/order/order-item/order-item-type";
import { useSessionStorage } from "@mantine/hooks";

import { norwegianTime } from "@/shared/utils/dayjs";

const translations = {
  rent: "lån til",
  return: "returner",
  extend: "forleng til",
  cancel: "kanseller",
  buy: "kjøp",
  "partly-payment": "delbetaling til",
  buyback: "tilbakekjøp",
  buyout: "kjøp ut",
  sell: "selg",
  loan: "lån til",
  "invoice-paid": "betale faktura",
  "match-receive": "motta fra elev",
  "match-deliver": "overlevere til elev",
} satisfies Record<OrderItemType, string>;

export default function useCart() {
  const [cart, setCart, clear] = useSessionStorage<CartItem[]>({
    key: "cart",
    defaultValue: [],
  });
  function add(cartItem: CartItem) {
    remove(cartItem.id);
    setCart((prev) => [...prev, cartItem].sort((a, b) => a.title.localeCompare(b.title)));
  }
  function remove(itemId: string) {
    setCart((prev) => prev.filter((cartItem) => cartItem.id !== itemId));
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
  function getSelectedOption(cartItem: CartItem) {
    const selectedOption = cartItem.options[cartItem.selectedOptionIndex];
    if (!selectedOption) {
      clear();
      throw new Error("Invalid selected option in cart!");
    }
    return selectedOption;
  }

  function getOptionLabel(option?: CartItemOption) {
    if (!option) throw new Error("Invalid cart item option!");
    return `${translations[option.type]} ${option.to ? norwegianTime(option.to).format("DD/MM/YYYY") : ""}`;
  }
  return {
    get: () => cart,
    size: () => cart.length,
    isEmpty: () => cart.length === 0,
    add,
    remove,
    clear,
    getSelectedOption,
    getOptionLabel,
    calculateTotal,
    calculatePayLater,
  };
}
