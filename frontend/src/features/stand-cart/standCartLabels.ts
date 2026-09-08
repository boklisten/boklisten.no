import type {
  StandCartActionType,
  StandCartChoice,
  StandCartLine,
  StandCartSource,
} from "@boklisten/backend/shared/stand_cart";
import { norwegianTime } from "@/shared/utils/dayjs";

export const ACTION_LABELS: Record<StandCartActionType, string> = {
  rent: "Lån",
  "partly-payment": "Delbetaling",
  buy: "Kjøp",
  sell: "Selg til oss",
  cancel: "Avbestill",
  return: "Lever inn",
  buyback: "Tilbakekjøp",
  extend: "Forleng",
  buyout: "Kjøp ut",
};

/** "Avbestill" unmakes an order; undoing a handout the customer already got is "Kanseller". */
export function actionLabel(
  type: StandCartActionType,
  sourceKind: StandCartSource["kind"],
): string {
  return type === "cancel" && sourceKind === "customerItem" ? "Kanseller" : ACTION_LABELS[type];
}

export function formatDeadline(iso: string): string {
  return norwegianTime(iso).format("DD.MM.YYYY");
}

export function formatAmount(amount: number): string {
  return amount < 0 ? `−${Math.abs(amount)} kr` : `${amount} kr`;
}

/** "Lån til 20.12.2026", "Kjøp ut". */
export function describeChoice(
  choice: StandCartChoice,
  sourceKind: StandCartSource["kind"],
): string {
  const label = actionLabel(choice.type, sourceKind);
  return choice.to === undefined ? label : `${label} til ${formatDeadline(choice.to)}`;
}

export function defaultChoice(line: StandCartLine): StandCartChoice {
  const option = line.options[line.defaultOptionIndex] ?? line.options[0];
  return option
    ? { type: option.type, ...(option.to === undefined ? {} : { to: option.to }) }
    : { type: "cancel" };
}
