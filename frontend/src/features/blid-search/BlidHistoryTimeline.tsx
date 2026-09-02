import type {
  BlidActiveItem,
  BlidHistoryEvent,
  BlidParty,
} from "@boklisten/backend/shared/blid_search";
import { Badge, Group, Text, ThemeIcon, Timeline } from "@mantine/core";
import {
  IconArrowsExchange,
  IconBookDownload,
  IconBookUpload,
  IconBuildingStore,
  IconCalendarDue,
  IconCalendarPlus,
  IconCalendarX,
  IconCoins,
  IconFileInvoice,
  IconShoppingCart,
  IconX,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import ActiveItemChips from "@/features/blid-search/ActiveItemChips";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import useAuth from "@/shared/hooks/useAuth";
import { norwegianTime } from "@/shared/utils/dayjs";

/** A named person in an event sentence: bold like plain text, but a link to their customer page. */
function PersonLink({ detailsId, name }: { detailsId: string; name: string }) {
  return (
    <TanStackAnchor
      to="/admin/kundesok"
      search={{ kunde: detailsId }}
      c="inherit"
      fw={700}
      underline="hover"
    >
      {name}
    </TanStackAnchor>
  );
}

function Party({ party }: { party: BlidParty }) {
  return party.type === "stand" ? (
    <>stand</>
  ) : (
    <PersonLink detailsId={party.detailsId} name={party.name} />
  );
}

/**
 * Every sentence states only what the records actually know, and never repeats the previous
 * holder — the timeline is a custody chain, so that person's own entry sits just below.
 * Employees are woven into the sentence rather than appended as metadata.
 */
function describeEvent(event: BlidHistoryEvent): ReactNode {
  const { action, from, to, byCustomer, handoutType } = event;
  const employee = event.employee && (
    <PersonLink detailsId={event.employee.detailsId} name={event.employee.name} />
  );
  switch (action) {
    case "handout": {
      if (to?.type !== "customer") {
        return "Boka ble delt ut";
      }
      if (from?.type === "customer") {
        // The previous holder is not repeated here — their own entry sits just below.
        return (
          <>
            <Party party={to} /> fikk boka
          </>
        );
      }
      if (handoutType === "partly-payment") {
        return (
          <>
            <Party party={to} /> delbetalte boka på stand{employee && <> hos {employee}</>}
          </>
        );
      }
      if (handoutType !== undefined) {
        return (
          <>
            <Party party={to} /> lånte boka på stand{employee && <> hos {employee}</>}
          </>
        );
      }
      return (
        <>
          <Party party={to} /> fikk boka på stand{employee && <> fra {employee}</>}
        </>
      );
    }
    case "return": {
      // The previous holder is not repeated here — their own entry sits just below.
      if (to?.type === "customer") {
        return (
          <>
            Boka ble levert til <Party party={to} />
          </>
        );
      }
      if (employee) {
        return <>{employee} samlet inn boka på stand</>;
      }
      return "Boka ble samlet inn på stand";
    }
    case "match-transfer": {
      // The previous holder is not repeated here — their own entry sits just below.
      if (to) {
        return (
          <>
            <Party party={to} />{" "}
            {byCustomer ? "skannet og overtok boka" : "fikk boka gjennom en overlevering"}
          </>
        );
      }
      return "Boka ble overlevert";
    }
    case "extend": {
      if (to?.type === "customer" && byCustomer) {
        return (
          <>
            <Party party={to} /> utsatte fristen
          </>
        );
      }
      if (employee) {
        return <>{employee} utsatte fristen</>;
      }
      return "Fristen ble utsatt";
    }
    case "buyout": {
      if (to?.type !== "customer") {
        return "Boka ble kjøpt ut";
      }
      return (
        <>
          <Party party={to} /> kjøpte ut boka{employee && <> hos {employee}</>}
        </>
      );
    }
    case "invoice-paid": {
      if (to?.type !== "customer") {
        return "Fakturaen for boka ble betalt";
      }
      return (
        <>
          <Party party={to} /> betalte faktura for boka
        </>
      );
    }
    case "buyback": {
      if (from?.type !== "customer") {
        return "Boka ble solgt tilbake til Boklisten";
      }
      if (employee) {
        return <>Boka ble solgt tilbake til Boklisten hos {employee}</>;
      }
      return (
        <>
          <Party party={from} /> solgte boka tilbake til Boklisten
        </>
      );
    }
    case "cancel": {
      if (employee) {
        return <>{employee} kansellerte utdelingen</>;
      }
      return "Utdelingen ble kansellert";
    }
    case "deadline-expired": {
      if (to?.type !== "customer") {
        return "Boka ble ikke levert innen fristen";
      }
      return (
        <>
          <Party party={to} /> leverte ikke boka innen fristen
        </>
      );
    }
    default: {
      return "Ukjent hendelse";
    }
  }
}

const EVENT_APPEARANCE = {
  handout: { icon: IconBookUpload, color: "green" },
  return: { icon: IconBookDownload, color: "blue" },
  "match-transfer": { icon: IconArrowsExchange, color: "violet" },
  extend: { icon: IconCalendarPlus, color: "orange" },
  buyout: { icon: IconShoppingCart, color: "teal" },
  "invoice-paid": { icon: IconFileInvoice, color: "teal" },
  buyback: { icon: IconCoins, color: "pink" },
  cancel: { icon: IconX, color: "red" },
  "deadline-expired": { icon: IconCalendarX, color: "red" },
} as const satisfies Record<BlidHistoryEvent["action"], unknown>;

function formatDate(iso: string): string {
  return norwegianTime(iso).format("DD.MM.YYYY");
}

function metaLine(event: BlidHistoryEvent): string {
  // The expiry is a state of affairs, not a recorded moment — a clock time would be noise.
  if (event.action === "deadline-expired") {
    return formatDate(event.time);
  }
  return norwegianTime(event.time).format("DD.MM.YYYY [kl.] HH:mm:ss");
}

function fristLabel(event: BlidHistoryEvent): string | null {
  if (event.action === "extend" && event.previousDeadline && event.deadline) {
    return `${formatDate(event.previousDeadline)} → ${formatDate(event.deadline)}`;
  }
  return event.deadline ? formatDate(event.deadline) : null;
}

/** Chips on the live entry describe the book's current state, not history. */
interface LiveChipsState {
  item: BlidActiveItem;
  editable: boolean;
  expired: boolean;
}

function EventChip({
  icon: Icon,
  color,
  label,
}: {
  icon: typeof IconBuildingStore;
  color: string;
  label: string;
}) {
  return (
    <Badge
      variant="light"
      color={color}
      tt="none"
      fw={500}
      leftSection={<Icon size={12} aria-hidden />}
    >
      {label}
    </Badge>
  );
}

function EventChips({ event, live }: { event: BlidHistoryEvent; live?: LiveChipsState }) {
  // The sentence and date already say everything the expiry knows.
  if (event.action === "deadline-expired") {
    return null;
  }
  if (live?.editable) {
    return (
      <ActiveItemChips
        activeItem={live.item}
        branchLabel={event.branchName ?? null}
        fristLabel={fristLabel(event) ?? formatDate(live.item.deadline)}
        expired={live.expired}
      />
    );
  }
  const frist = fristLabel(event) ?? (live ? formatDate(live.item.deadline) : null);
  if (!event.branchName && frist === null) {
    return null;
  }
  return (
    <Group gap={6} mt={6}>
      {event.branchName && (
        <EventChip icon={IconBuildingStore} color="gray" label={event.branchName} />
      )}
      {frist !== null && (
        <EventChip
          icon={IconCalendarDue}
          color={live?.expired ? "red" : "gray"}
          label={`Frist: ${frist}`}
        />
      )}
    </Group>
  );
}

/** The book's custody chain, newest first: every handout, return, transfer and deadline change. */
export default function BlidHistoryTimeline({
  history,
  activeItem,
}: {
  history: BlidHistoryEvent[];
  activeItem?: BlidActiveItem;
}) {
  const { isAdmin } = useAuth();
  if (history.length === 0) {
    return <Text c="dimmed">Ingen hendelser er registrert på denne boka.</Text>;
  }
  // The newest entry that is not the synthetic expiry carries the book's current branch and
  // deadline; for admins those chips open the corrections to the active loan.
  const liveIndex = activeItem
    ? history.findIndex((event) => event.action !== "deadline-expired")
    : -1;
  // The synthetic expiry always sorts first, so its presence means the live deadline is overdue.
  const expired = history[0]?.action === "deadline-expired";
  return (
    <Timeline bulletSize={28} lineWidth={2}>
      {history.map((event, index) => {
        const { icon: Icon, color } = EVENT_APPEARANCE[event.action];
        return (
          <Timeline.Item
            // History is append-only and render-only, so the position identifies the row.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            bullet={
              // variant="light" matches the status badge's rendering of the same color.
              <ThemeIcon variant="light" color={color} size={28} radius="xl">
                <Icon size={16} aria-hidden />
              </ThemeIcon>
            }
          >
            <Text>{describeEvent(event)}</Text>
            <Text size="xs" c="dimmed">
              {metaLine(event)}
            </Text>
            <EventChips
              event={event}
              live={
                index === liveIndex && activeItem
                  ? { item: activeItem, editable: isAdmin, expired }
                  : undefined
              }
            />
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
}
