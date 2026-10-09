import { Accordion, Badge, Box, Stack, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { IconBasketCheck, IconClockPlus, IconShoppingCart, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import BookActionMenu from "@/features/book-list/BookActionMenu";
import type { BookAction } from "@/features/book-list/BookActionMenu";
import BookDetailsModal from "@/features/book-list/BookDetailsModal";
import type { BookDetailsTarget } from "@/features/book-list/BookDetailsModal";
import BookGroup from "@/features/book-list/BookGroup";
import BookOverview from "@/features/book-list/BookOverview";
import BookRow from "@/features/book-list/BookRow";
import { groupBooks } from "@/features/book-list/bookGroups";
import InvoiceBadge from "@/features/book-list/InvoiceBadge";
import PeerNameBadge from "@/features/book-list/PeerNameBadge";
import {
  buildDeliverToPeers,
  buildReceiveFromPeers,
} from "@/features/customer-search/handoutBooks";
import type { PeerBook } from "@/features/customer-search/handoutBooks";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import InfoAlert from "@/shared/components/alerts/InfoAlert";
import TanStackButton from "@/shared/components/TanStackButton";
import useAuth from "@/shared/hooks/useAuth";
import useCart from "@/shared/hooks/useCart";
import { api } from "@/shared/utils/apiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";
import type { Route } from "@tuyau/core/types";

type CustomerBook = Route.Response<"customer_items.me">[number];
type OrderedBook = Route.Response<"orders.open_items_me">[number];

function Blid({ blid }: { blid: string | null }) {
  return blid === null ? null : (
    <Text span size="sm" c="dimmed" ff="monospace">
      {blid}
    </Text>
  );
}

/** Extend and buyout for one book, going into the cart and out again. */
function useBookActions(book: CustomerBook): BookAction[] {
  const cart = useCart();
  const available = book.actions.filter((action) => action.available);
  return book.actions.map((action) => {
    const inCart = cart
      .get()
      .some(
        (entry) =>
          entry.id === book.item.id &&
          cart.getSelectedOption(entry).type === action.type &&
          ("to" in action ? cart.getSelectedOption(entry).to === action.to : true),
      );
    return {
      key: `${action.type}:${"to" in action ? action.to : ""}`,
      label: action.label,
      description: `${action.price} kr`,
      icon: inCart ? IconBasketCheck : action.type === "extend" ? IconClockPlus : IconShoppingCart,
      color: inCart ? "green" : undefined,
      blockedReason: action.available ? undefined : action.tooltip || "Ikke tilgjengelig nå",
      selected: inCart,
      onClick: () => {
        if (inCart) {
          cart.remove(book.item.id);
          return;
        }
        cart.add({
          id: book.item.id,
          title: book.item.title,
          branchId: book.branch.id,
          options: available.map((option) => ({
            type: option.type,
            price: option.price,
            ...("to" in option ? { to: option.to } : {}),
          })),
          selectedOptionIndex: Math.max(available.indexOf(action), 0),
        });
      },
    };
  });
}

function HeldBookActions({ book }: { book: CustomerBook }) {
  const actions = useBookActions(book);
  if (actions.length === 0) {
    return null;
  }
  return <BookActionMenu label="Forleng eller kjøp ut" actions={actions} />;
}

function CancelOrderedBook({ book }: { book: OrderedBook }) {
  const queryClient = useQueryClient();
  const cancelMutation = useMutation(
    api.orders.cancelItemMe.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: api.orders.openItemsMe.pathKey() }),
      onSuccess: () => showSuccessNotification(`${book.title} ble avbestilt`),
      onError: () => showErrorNotification("Klarte ikke avbestille boka"),
    }),
  );
  return (
    <BookActionMenu
      label="Avbestill"
      loading={cancelMutation.isPending}
      actions={[
        {
          key: "cancel",
          label: "Avbestill",
          icon: IconX,
          color: "red",
          blockedReason: book.cancelable
            ? undefined
            : "Kan ikke avbestilles nå. Ta kontakt dersom du vil avbestille.",
          onClick: () =>
            modals.openConfirmModal({
              title: "Avbestill boka?",
              children: `Du avbestiller ${book.title}. Dette kan ikke angres.`,
              confirmProps: { color: "red" },
              labels: { cancel: "Behold", confirm: "Avbestill" },
              onConfirm: () =>
                cancelMutation.mutate({ body: { orderId: book.orderId, itemId: book.itemId } }),
            }),
        },
      ]}
    />
  );
}

/** The book whose details are open, and its overlevering as its row says it. */
interface OpenedBook {
  target: BookDetailsTarget;
  note?: ReactNode;
}

const receiveFromBadge = (peer: PeerBook) => <PeerNameBadge label="Får du av" peer={peer} />;
const deliverToBadge = (peer: PeerBook) => <PeerNameBadge label="Skal leveres til" peer={peer} />;

/** Still with the customer; every other status ends the loan and moves the book to earlier. */
const isHeld = (book: CustomerBook) =>
  book.status.type === "active" || book.status.type === "overdue";

const orderedKey = (book: OrderedBook) => `${book.orderId}:${book.itemId}`;

const customerItemGroupKey = (book: CustomerBook) => ({
  type: book.type,
  branchName: book.branch.name,
  deadline: book.deadline,
});

function OrderedGroups({
  books,
  peers,
  onOpen,
}: {
  books: OrderedBook[];
  /** For books another student brings, that student, keyed by order and item. */
  peers: Map<string, PeerBook>;
  onOpen: (opened: OpenedBook) => void;
}) {
  return groupBooks(books, (book) => ({
    type: book.type,
    branchName: book.branch.name,
    deadline: book.deadline === "" ? null : book.deadline,
  })).map((group) => (
    <BookGroup key={group.key} group={group} held={false}>
      {group.books.map((book) => {
        const peer = peers.get(orderedKey(book));
        return (
          <BookRow
            key={orderedKey(book)}
            title={book.title}
            isbn={book.isbn}
            meta={peer && receiveFromBadge(peer)}
            action={<CancelOrderedBook book={book} />}
            tone={peer ? "peer" : undefined}
            onOpen={() =>
              onOpen({
                target: { kind: "ordered", orderId: book.orderId, itemId: book.itemId },
                note: peer && receiveFromBadge(peer),
              })
            }
          />
        );
      })}
    </BookGroup>
  ));
}

/**
 * The overleveringer behind the customer's books: who brings each ordered book that comes from
 * another student (keyed by order and item), and who gets each held book they are to hand on
 * (keyed by customer item).
 */
function usePeers(ordered: OrderedBook[] | undefined, held: CustomerBook[] | undefined) {
  const { userId } = useAuth();
  const { data: matches } = useQuery(api.matches.me.queryOptions({}, { staleTime: 5000 }));
  const givers = buildReceiveFromPeers(ordered ?? [], matches ?? [], userId ?? "", (book) => ({
    key: orderedKey(book),
    itemId: book.itemId,
  }));
  const receivers = buildDeliverToPeers(
    (held ?? []).map((book) => ({ id: book.id, itemId: book.item.id })),
    matches ?? [],
    userId ?? "",
  );
  return { givers, receivers };
}

function HeldBooks({
  books,
  receivers,
  onOpen,
}: {
  books: CustomerBook[];
  /** For books to be handed to another student, who gets each, keyed by customer item. */
  receivers: Map<string, PeerBook>;
  onOpen: (opened: OpenedBook) => void;
}) {
  return groupBooks(books, customerItemGroupKey).map((group) => (
    <BookGroup key={group.key} group={group}>
      {group.books.map((book) => {
        const receiver = receivers.get(book.id);
        return (
          <BookRow
            key={book.id}
            title={book.item.title}
            isbn={book.item.isbn}
            meta={
              <>
                <Blid blid={book.blid} />
                <InvoiceBadge invoice={book.invoice} />
                {receiver && deliverToBadge(receiver)}
              </>
            }
            action={<HeldBookActions book={book} />}
            tone={receiver ? "peer" : undefined}
            onOpen={() =>
              onOpen({
                target: { kind: "customer-item", id: book.id },
                note: receiver && deliverToBadge(receiver),
              })
            }
          />
        );
      })}
    </BookGroup>
  ));
}

function EarlierBooks({
  books,
  onOpen,
}: {
  books: CustomerBook[];
  onOpen: (opened: OpenedBook) => void;
}) {
  if (books.length === 0) {
    return <InfoAlert title="Du har ikke levert tilbake eller kjøpt ut noen bøker ennå" />;
  }
  return groupBooks(books, customerItemGroupKey)
    .toReversed()
    .map((group) => (
      <BookGroup key={group.key} group={group} held={false}>
        {group.books.map((book) => (
          <BookRow
            key={book.id}
            muted
            title={book.item.title}
            isbn={book.item.isbn}
            meta={
              <>
                <Badge size="sm" variant="light" color="gray" tt="none">
                  {book.status.text}
                </Badge>
                <Blid blid={book.blid} />
                <InvoiceBadge invoice={book.invoice} />
              </>
            }
            onOpen={() => onOpen({ target: { kind: "customer-item", id: book.id } })}
          />
        ))}
      </BookGroup>
    ));
}

export default function CustomerItemsOverview() {
  const [opened, setOpened] = useState<OpenedBook | null>(null);
  const customerItems = useQuery(api.customerItems.me.queryOptions());
  const orderedItems = useQuery(api.orders.openItemsMe.queryOptions());
  const books = customerItems.data;
  const heldBooks = books?.filter(isHeld);
  const { givers, receivers } = usePeers(orderedItems.data, heldBooks);

  if (customerItems.isError || orderedItems.isError) {
    return (
      <ErrorAlert title="Klarte ikke laste inn bøkene dine">{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
    );
  }

  // Books from the stand first in each deadline group; one a student brings follows, marked
  const ordered = orderedItems.data?.toSorted(
    (a, b) => Number(givers.has(orderedKey(a))) - Number(givers.has(orderedKey(b))),
  );
  const earlier = books?.filter((book) => !isHeld(book));

  return (
    <Stack gap="xl" mt="md">
      <BookOverview
        audience="customer"
        ordered={{
          count: ordered?.length,
          content: ordered && <OrderedGroups books={ordered} peers={givers} onOpen={setOpened} />,
        }}
        orderedFooter={
          <Box>
            <TanStackButton to="/bestilling" leftSection={<IconShoppingCart aria-hidden />}>
              {(ordered?.length ?? 0) > 0 ? "Bestill flere bøker" : "Bestill bøker"}
            </TanStackButton>
          </Box>
        }
        held={{
          count: heldBooks?.length,
          content: heldBooks && (
            <HeldBooks books={heldBooks} receivers={receivers} onOpen={setOpened} />
          ),
        }}
      />

      {earlier && (
        <Accordion variant="contained" radius="md">
          <Accordion.Item value="earlier">
            <Accordion.Control>
              <Text fw={600}>Tidligere bøker ({earlier.length})</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                <EarlierBooks books={earlier} onOpen={setOpened} />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}

      <BookDetailsModal
        target={opened?.target ?? null}
        note={opened?.note}
        audience="customer"
        onClose={() => setOpened(null)}
      />
    </Stack>
  );
}
