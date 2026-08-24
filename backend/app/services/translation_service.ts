import { OrderItemType } from "#shared/order/order-item/order-item-type";
import { PaymentMethod } from "#shared/payment/payment-method/payment-method";

export const TranslationService = {
  translateOrderItemTypePastTense(orderItemType: OrderItemType) {
    return {
      rent: "lån",
      return: "returnert",
      extend: "forlenget",
      cancel: "kansellert",
      buy: "kjøp",
      "partly-payment": "delbetaling",
      buyback: "tilbakekjøp",
      buyout: "utkjøp",
      sell: "solgt",
      loan: "utlånt",
      "invoice-paid": "betalt faktura",
      "match-receive": "mottatt fra elev",
      "match-deliver": "overlevert til elev",
    }[orderItemType];
  },
  translateOrderItemTypeImperative(orderItemType: OrderItemType) {
    return {
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
    }[orderItemType];
  },
  translatePaymentMethod(paymentMethod: PaymentMethod) {
    return {
      cash: "kontanter",
      card: "kort",
      vipps: "Vipps",
      "vipps-checkout": "Vipps Checkout",
      branch: "på filial",
      later: "betales senere",
      cashout: "betalt til kunde",
    }[paymentMethod];
  },
};
