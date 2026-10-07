import type {
  BookDetails,
  BookInvoiceEntry,
  CustomerItemDetails,
} from "@boklisten/backend/shared/book-details";
import {
  Alert,
  CloseButton,
  Divider,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import BookCover from "@/features/book-cover/BookCover";
import { periodLabel } from "@/features/book-list/bookGroups";
import { InvoiceStatusBadge } from "@/features/book-list/InvoiceBadge";
import BlidLink from "@/features/kasse/BlidLink";
import { PhoneSheet } from "@/features/layout/nav/MenuSheet";
import useDisplayName from "@/features/customer-search/useDisplayName";
import CustomerLink from "@/features/kasse/CustomerLink";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import EntityLink from "@/shared/components/EntityLink";
import useAuth from "@/shared/hooks/useAuth";
import { api } from "@/shared/utils/apiClient";
import { norwegianTime } from "@/shared/utils/dayjs";
import { formatDeadline, isOverdue } from "@/shared/utils/deadline";

/** Which book to open: a handed-out (or earlier) copy, or a book still on an order. */
export type BookDetailsTarget =
  | { kind: "customer-item"; id: string }
  | { kind: "ordered"; orderId: string; itemId: string };

/** Customers see their own books; the stand sees anyone's, with links and employee names. */
export type BookDetailsAudience = "customer" | "employee";

const formatTime = (iso: string) => norwegianTime(iso).format("DD.MM.YYYY [kl.] HH:mm:ss");
const formatDay = (date: string) => formatDeadline(date, "DD.MM.YYYY");

function useBookDetails(target: BookDetailsTarget, audience: BookDetailsAudience) {
  const customerItem = target.kind === "customer-item" ? target : null;
  const ordered = target.kind === "ordered" ? target : null;
  const customerItemQuery = useQuery({
    ...(audience === "customer"
      ? api.customerItems.detailsMe.queryOptions({
          params: { customerItemId: customerItem?.id ?? "" },
        })
      : api.customerItems.details.queryOptions({
          params: { customerItemId: customerItem?.id ?? "" },
        })),
    enabled: customerItem !== null,
  });
  const orderedQuery = useQuery({
    ...(audience === "customer"
      ? api.orders.itemDetailsMe.queryOptions({
          params: { orderId: ordered?.orderId ?? "", itemId: ordered?.itemId ?? "" },
        })
      : api.orders.itemDetails.queryOptions({
          params: { orderId: ordered?.orderId ?? "", itemId: ordered?.itemId ?? "" },
        })),
    enabled: ordered !== null,
  });
  return customerItem ? customerItemQuery : orderedQuery;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={6}>
      <Title order={4} size="h5">
        {title}
      </Title>
      {children}
    </Stack>
  );
}

/** A label and its value on one line, wrapping under each other on a narrow screen. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group gap={6} wrap="wrap" align="baseline">
      <Text size="sm" c="dimmed" miw={90}>
        {label}
      </Text>
      <Text size="sm" span>
        {children}
      </Text>
    </Group>
  );
}

function Person({
  userId,
  name,
  audience,
}: {
  userId: string | null;
  name: string;
  audience: BookDetailsAudience;
}) {
  // Shortened on a phone, so the fact stays on one line
  const displayName = useDisplayName();
  if (audience === "employee" && userId !== null) {
    return (
      <CustomerLink userId={userId} inherit>
        {displayName(name)}
      </CustomerLink>
    );
  }
  return (
    <Text span fw={600} inherit>
      {displayName(name)}
    </Text>
  );
}

function HandoutFacts({
  details,
  audience,
}: {
  details: CustomerItemDetails;
  audience: BookDetailsAudience;
}) {
  const { by } = details.handout;
  const ended = details.ended;
  return (
    <Section title="Utdeling">
      <Fact label="Utdelt">{formatTime(details.handout.at)}</Fact>
      {by?.kind === "peer" ? (
        <Fact label="Overlevert fra">
          <Person userId={by.userId} name={by.name} audience={audience} />
        </Fact>
      ) : (
        <Fact label="Delt ut på">{details.branch.name}</Fact>
      )}
      {by?.kind === "employee" && (
        <Fact label="Delt ut av">
          <Person userId={by.userId} name={by.name} audience={audience} />
        </Fact>
      )}
      {ended && (
        <Fact label={ENDED_LABELS[ended.kind]}>
          {ended.at ? formatTime(ended.at) : "Ukjent tidspunkt"}
          {ended.branchName && ` på ${ended.branchName}`}
        </Fact>
      )}
    </Section>
  );
}

const ENDED_LABELS: Record<NonNullable<CustomerItemDetails["ended"]>["kind"], string> = {
  returned: "Levert tilbake",
  buyout: "Kjøpt ut",
  buyback: "Solgt tilbake",
  cancel: "Kansellert",
};

function InvoiceList({ invoices }: { invoices: BookInvoiceEntry[] }) {
  const { isAdmin } = useAuth();
  return (
    <Section title="Faktura">
      {invoices.map((invoice) => (
        <Stack key={invoice.id} gap={2}>
          <Group gap="xs">
            {isAdmin ? (
              <EntityLink size="sm" to="/admin/faktura" search={{ faktura: invoice.id }}>
                Faktura {invoice.invoiceNumber}
              </EntityLink>
            ) : (
              <Text size="sm" fw={600}>
                Faktura {invoice.invoiceNumber}
              </Text>
            )}
            <InvoiceStatusBadge status={invoice.status} />
          </Group>
          <Text size="xs" c="dimmed">
            {invoice.amount} kr for denne boka · forfall {formatDay(invoice.dueDate)}
          </Text>
        </Stack>
      ))}
    </Section>
  );
}

function OverdueAlert({
  deadline,
  audience,
  invoiced,
}: {
  deadline: string;
  audience: BookDetailsAudience;
  /** An invoice for the book is still owed, so there is no invoice left to avoid. */
  invoiced: boolean;
}) {
  return (
    <Alert color="red" variant="filled" icon={<IconAlertTriangle aria-hidden />}>
      Fristen gikk ut {formatDay(deadline)}.{" "}
      {audience === "employee"
        ? "Kunden har ikke levert boka."
        : invoiced
          ? "Boka er fakturert."
          : "Lever boka så snart som mulig, eller kjøp den ut, for å unngå faktura."}
    </Alert>
  );
}

function DetailsBody({
  details,
  audience,
  corrections,
  note,
}: {
  details: BookDetails;
  audience: BookDetailsAudience;
  corrections?: ReactNode;
  note?: ReactNode;
}) {
  const held =
    details.kind === "customer-item" &&
    (details.status.type === "active" || details.status.type === "overdue");
  const deadline = details.deadline;
  const overdue = held && deadline !== null && isOverdue(deadline);
  const invoiced =
    details.kind === "customer-item" &&
    details.invoices.some(({ status }) => status === "unpaid" || status === "debt-collection");
  const period = periodLabel({ type: details.type, deadline });
  return (
    <Stack gap="md">
      <Group gap="md" wrap="nowrap" align="flex-start">
        <BookCover isbn={details.isbn} title={details.title} size="xl" />
        <Stack gap={4} miw={0}>
          <Title order={3} lh={1.25}>
            {details.title}
          </Title>
          {/* The corrections chips name the branch and period themselves. */}
          {!corrections && (
            <Text size="sm">
              {period} · {details.branch.name}
            </Text>
          )}
          <Fact label="ISBN">{details.isbn ?? "Ingen"}</Fact>
          {details.kind === "customer-item" && details.blid && (
            <Fact label="Unik ID">
              {audience === "employee" ? (
                <BlidLink blid={details.blid} />
              ) : (
                <Text span size="sm" ff="monospace">
                  {details.blid}
                </Text>
              )}
            </Fact>
          )}
          {details.kind === "ordered" && <Fact label="Status">Bestilt, ikke delt ut</Fact>}
          {details.kind === "customer-item" && !held && (
            <Fact label="Status">{details.status.text}</Fact>
          )}
        </Stack>
      </Group>

      {note && <Group>{note}</Group>}
      {overdue && deadline !== null && (
        <OverdueAlert deadline={deadline} audience={audience} invoiced={invoiced} />
      )}
      {corrections}

      {details.kind === "customer-item" && details.invoices.length > 0 && (
        <InvoiceList invoices={details.invoices} />
      )}
      {details.kind === "customer-item" && (
        <>
          <Divider />
          <HandoutFacts details={details} audience={audience} />
        </>
      )}
    </Stack>
  );
}

/**
 * Everything known about one book, opened from its row. The same modal serves the customer's own
 * page and the stand: the stand also sees employees, links to the customer and the invoice, and may
 * pass the corrections it can make to the book.
 */
export default function BookDetailsModal({
  target,
  audience,
  corrections,
  note,
  onClose,
}: {
  target: BookDetailsTarget | null;
  audience: BookDetailsAudience;
  /** Employee-only edits (branch, deadline), shown under the header. */
  corrections?: ReactNode;
  /** The overlevering the book goes through, said the same way as on its row. */
  note?: ReactNode;
  onClose: () => void;
}) {
  // The same width at which the site menu turns into a sheet; it only opens after hydration.
  const wide = useMediaQuery("(min-width: 48em)");
  // The last book opened stays in place while the sheet or modal animates closed.
  const [shown, setShown] = useState({ target, corrections, note });
  if (
    target !== null &&
    (target !== shown.target || corrections !== shown.corrections || note !== shown.note)
  ) {
    setShown({ target, corrections, note });
  }
  const content = shown.target && (
    <ModalContent
      target={shown.target}
      audience={audience}
      corrections={shown.corrections}
      note={shown.note}
    />
  );
  if (!wide) {
    return (
      <PhoneSheet opened={target !== null} onClose={onClose} label="Om boka" belowModals>
        <Stack gap="sm" px="md">
          <Group justify="space-between" wrap="nowrap">
            <Text fw={600}>Om boka</Text>
            <CloseButton aria-label="Lukk" onClick={onClose} />
          </Group>
          {content}
        </Stack>
      </PhoneSheet>
    );
  }
  return (
    <Modal opened={target !== null} onClose={onClose} title="Om boka" size="lg" centered>
      {content}
    </Modal>
  );
}

/** A value still on its way, on the line of the fact it belongs to. */
function PendingValue({ width }: { width: number }) {
  return <Skeleton height={12} width={width} radius="sm" display="inline-block" />;
}

/**
 * The details as they will stand, with the values still loading: the labels are known up front,
 * so the modal does not change shape when the book arrives. The corrections need nothing from the
 * request and show at once.
 */
function DetailsSkeleton({
  target,
  audience,
  corrections,
  note,
}: {
  target: BookDetailsTarget;
  audience: BookDetailsAudience;
  corrections?: ReactNode;
  note?: ReactNode;
}) {
  const handedOut = target.kind === "customer-item";
  return (
    <Stack gap="md" aria-busy>
      <Group gap="md" wrap="nowrap" align="flex-start">
        <Skeleton width={88} height={120} radius="sm" />
        <Stack gap={4} miw={0} flex={1}>
          <Skeleton height={22} width="70%" my={3} />
          {!corrections && <Skeleton height={12} width="55%" my={4} />}
          <Fact label="ISBN">
            <PendingValue width={110} />
          </Fact>
          <Fact label={handedOut ? "Unik ID" : "Status"}>
            <PendingValue width={handedOut ? 100 : 130} />
          </Fact>
        </Stack>
      </Group>
      {note && <Group>{note}</Group>}
      {corrections}
      {handedOut && (
        <>
          <Divider />
          <Section title="Utdeling">
            <Fact label="Utdelt">
              <PendingValue width={150} />
            </Fact>
            <Fact label="Delt ut på">
              <PendingValue width={120} />
            </Fact>
            {audience === "employee" && (
              <Fact label="Delt ut av">
                <PendingValue width={130} />
              </Fact>
            )}
          </Section>
        </>
      )}
    </Stack>
  );
}

function ModalContent({
  target,
  audience,
  corrections,
  note,
}: {
  target: BookDetailsTarget;
  audience: BookDetailsAudience;
  corrections?: ReactNode;
  note?: ReactNode;
}) {
  const { data, isPending, isError } = useBookDetails(target, audience);
  if (isPending) {
    return (
      <DetailsSkeleton target={target} audience={audience} corrections={corrections} note={note} />
    );
  }
  if (isError) {
    return <ErrorAlert>Klarte ikke laste inn detaljene om boka.</ErrorAlert>;
  }
  return <DetailsBody details={data} audience={audience} corrections={corrections} note={note} />;
}
