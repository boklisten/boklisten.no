import type { UserDetail } from "@boklisten/backend/shared/user-detail";

import type { ScanNotice } from "@/shared/components/scanner/ScannerPanel";
import useApiClient from "@/shared/hooks/useApiClient";
import { showErrorNotification } from "@/shared/utils/notifications";
import { determineScanCodeType } from "@/shared/utils/scanCodes";

export interface CodeTargets {
  /** May return a notice when the book could not be used, e.g. it is not out on loan. */
  onBlid: (blid: string) => Promise<ScanNotice | undefined> | ScanNotice | undefined | void;
  onCustomer: (customer: UserDetail) => void;
}

/**
 * Turns a scanned or typed code into a customer or a book. Every scanner on the Kasse page (camera,
 * manual entry, physical barcode scanner) funnels through this, so a customer's QR code and a
 * book's unique ID behave the same no matter how they arrived.
 */
export default function useCodeResolver({ onBlid, onCustomer }: CodeTargets) {
  const { client } = useApiClient();

  /** Resolves the code, returning a notice for the caller to display when it led nowhere. */
  async function resolveCode(code: string): Promise<ScanNotice | undefined> {
    switch (determineScanCodeType(code)) {
      case "blid": {
        return (await onBlid(code)) ?? undefined;
      }
      case "customerId": {
        const customer = await client.api.userDetail.getById({ params: { detailsId: code } });
        if (!customer) {
          return { message: `Fant ingen kunde med kunde-ID ${code}.` };
        }
        onCustomer(customer);
        return undefined;
      }
      default: {
        return {
          title: "Ukjent kode",
          message: "Koden er verken en kunde-ID eller bokas unike ID.",
        };
      }
    }
  }

  /** For inputs without a notice UI of their own: the physical scanner and manual entry. */
  async function resolveCodeOrNotify(code: string): Promise<void> {
    const notice = await resolveCode(code);
    if (notice) {
      showErrorNotification({ title: notice.title, message: notice.message });
    }
  }

  return { resolveCode, resolveCodeOrNotify };
}
