import type { UserDetail } from "@boklisten/backend/shared/user-detail";

import openScannerModal from "@/shared/components/scanner/openScannerModal";
import useApiClient from "@/shared/hooks/useApiClient";

export default function useCustomerScanner(onSelect: (userDetail: UserDetail) => void) {
  const { client } = useApiClient();

  return function openCustomerScanner() {
    openScannerModal({
      title: "Skann kundeID",
      onScan: async (scannedText) => {
        const userDetail = await client.api.userDetail.getById({
          params: { detailsId: scannedText },
        });
        if (!userDetail) {
          return { message: `Fant ingen kunde med kundeID ${scannedText}.` };
        }
        onSelect(userDetail);
        return undefined;
      },
    });
  };
}
