import type { User } from "@boklisten/backend/shared/user";
import { Loader, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import MessageEntryList from "@/features/message-log/MessageEntryList";
import { normalizeRecipient } from "@/features/message-log/meta";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { api } from "@/shared/utils/apiClient";

const POLL_INTERVAL_MS = 5000;

/** The guardian's contact info, normalized like log recipients, for the "Foresatt" badge. */
function guardianRecipientsOf(customer: User): ReadonlySet<string> {
  const recipients = new Set<string>();
  if (customer.guardianEmail) {
    recipients.add(normalizeRecipient("email", customer.guardianEmail));
  }
  if (customer.guardianPhone) {
    recipients.add(normalizeRecipient("sms", customer.guardianPhone));
  }
  // Contact info shared between the customer and the guardian belongs to the customer.
  recipients.delete(normalizeRecipient("email", customer.email ?? ""));
  recipients.delete(normalizeRecipient("sms", customer.phone ?? ""));
  return recipients;
}

export default function CustomerMessagesView({ customer }: { customer: User }) {
  const { data, isPending, error, errorUpdateCount } = useQuery(
    api.messageLogs.forCustomer.queryOptions(
      { params: { detailsId: customer.id } },
      { refetchInterval: POLL_INTERVAL_MS },
    ),
  );

  if (error && errorUpdateCount > 0) {
    return <ErrorAlert>Kunne ikke hente meldingene. Prøv igjen senere.</ErrorAlert>;
  }
  if (isPending || !data) {
    return <Loader mx="auto" display="block" my="lg" />;
  }

  return (
    <Stack gap="xs">
      <MessageEntryList
        entries={data.entries}
        guardianRecipients={guardianRecipientsOf(customer)}
        emptyText="Ingen meldinger er sendt til denne kunden ennå."
      />
    </Stack>
  );
}
