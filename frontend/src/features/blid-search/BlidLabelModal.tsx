import { Modal, Skeleton, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";

/** 696 x 271 printer dots, the printable area of the label the stickers are printed on. */
const LABEL_ASPECT_RATIO = "696 / 271";

/**
 * The sticker for a blid, drawn by the backend from the same layout as the printed labels, big
 * enough to scan straight off the screen when testing.
 */
export default function BlidLabelModal({
  blid,
  opened,
  onClose,
}: {
  blid: string;
  opened: boolean;
  onClose: () => void;
}) {
  const { api } = useApiClient();
  const { data, isPending, isError } = useQuery({
    ...api.uniqueIds.label.queryOptions({ params: { blid } }),
    enabled: opened,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Unik ID" size="md" centered>
      <Stack gap="sm">
        {isError ? (
          <ErrorAlert>Kunne ikke tegne etiketten. Prøv igjen.</ErrorAlert>
        ) : isPending ? (
          <Skeleton radius="md" style={{ aspectRatio: LABEL_ASPECT_RATIO }} />
        ) : (
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(data.svg)}`}
            alt={`Etikett for unik ID ${blid}`}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              aspectRatio: LABEL_ASPECT_RATIO,
              borderRadius: "var(--mantine-radius-md)",
            }}
          />
        )}
      </Stack>
    </Modal>
  );
}
