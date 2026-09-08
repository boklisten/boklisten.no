import type { OrderManagerFilter } from "@boklisten/backend/shared/order_manager";
import { BRING_PARCEL_LABELS } from "@boklisten/backend/shared/order_manager";
import { Button, Menu } from "@mantine/core";
import { IconChevronDown, IconFileDownload } from "@tabler/icons-react";
import dayjs from "dayjs";

import useReportDownload from "@/features/reports/useReportDownload";
import useApiClient from "@/shared/hooks/useApiClient";

/**
 * The three files the stand needs from the list it is looking at: the overview of every open
 * book, and Mybring's two bulk-booking files. One download per click, so the browser never gets
 * to block a second one.
 */
export default function OrderDownloadsMenu({ filter }: { filter: OrderManagerFilter }) {
  const { client } = useApiClient();
  const stamp = dayjs().format("YYYY-MM-DD");
  const overview = useReportDownload({
    fetchRows: () => client.api.orderManager.ordersReport({ query: filter }),
    filename: `bestillinger-${stamp}.csv`,
  });
  const mailbox = useReportDownload({
    fetchRows: () =>
      client.api.orderManager.bringReport({ query: { ...filter, parcelType: "postkasse" } }),
    filename: `bring-postkasse-${stamp}.csv`,
  });
  const pickup = useReportDownload({
    fetchRows: () =>
      client.api.orderManager.bringReport({ query: { ...filter, parcelType: "hentested" } }),
    filename: `bring-hentested-${stamp}.csv`,
  });
  const busy = overview.isLoading || mailbox.isLoading || pickup.isLoading;

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button
          variant="default"
          leftSection={<IconFileDownload size={18} aria-hidden />}
          rightSection={<IconChevronDown size={16} aria-hidden />}
          loading={busy}
        >
          Last ned
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Alle bestillinger i listen</Menu.Label>
        <Menu.Item onClick={() => void overview.download()}>Ordreoversikt (CSV)</Menu.Item>
        <Menu.Label>Bring-leveranser, for import i Mybring</Menu.Label>
        <Menu.Item onClick={() => void mailbox.download()}>
          {BRING_PARCEL_LABELS.postkasse} (CSV)
        </Menu.Item>
        <Menu.Item onClick={() => void pickup.download()}>
          {BRING_PARCEL_LABELS.hentested} (CSV)
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
