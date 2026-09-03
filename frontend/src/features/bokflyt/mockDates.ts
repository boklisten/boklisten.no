/**
 * The mocked handover round takes place on 16 June. The figures always show
 * the next one: this year's while it is still ahead, otherwise next year's.
 */
const HANDOVER_MONTH_INDEX = 5;
const HANDOVER_DAY = 16;

/** Matches the backend's `SIGNATURE_NUM_MONTHS_VALID` of 48 months. */
const SIGNATURE_YEARS_VALID = 4;

export function handoverYear(now = new Date()): number {
  const year = now.getFullYear();
  const passed =
    now.getMonth() > HANDOVER_MONTH_INDEX ||
    (now.getMonth() === HANDOVER_MONTH_INDEX && now.getDate() > HANDOVER_DAY);
  return passed ? year + 1 : year;
}

/** An ISO timestamp in the handover year, e.g. `inHandoverYear("06-16T12:15:00+02:00")`. */
export function inHandoverYear(monthDayTime: string): string {
  return `${handoverYear()}-${monthDayTime}`;
}

/** "16. juni <year>", as the signed-agreement screen prints dates. */
export function handoverDateText(yearsLater = 0): string {
  return `${HANDOVER_DAY}. juni ${handoverYear() + yearsLater}`;
}

export function signatureExpiryText(): string {
  return handoverDateText(SIGNATURE_YEARS_VALID);
}
