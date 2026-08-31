// "loan" is no longer written (loans were retired), but exists on reminder messages from 2019-2023
export type MessageSubtype =
  | "partly-payment"
  | "rent"
  | "loan"
  | "none"
  | "confirmed"
  | "canceled"
  | "all";
