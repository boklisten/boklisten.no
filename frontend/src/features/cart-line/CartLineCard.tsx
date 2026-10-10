import { ActionIcon, ThemeIcon } from "@mantine/core";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { useId } from "react";
import type { ReactNode } from "react";

import BookCoverArt from "@/features/book-cover/BookCoverArt";
import type { Isbn } from "@/features/book-cover/bookCoverQuery";
import classes from "@/features/cart-line/CartLine.module.css";
import { signedKroner } from "@/features/cart-line/cartLineLabels";
import type { BookEventAppearance } from "@/shared/components/bookEventAppearance";

/** One way the book can go, in the words both carts use: "Delbetaling til 1. juli 2027". */
export interface CartLineChoice {
  key: string;
  label: string;
  /** The way's picture from the book's history in Boksøk, the same in both carts. */
  appearance: BookEventAppearance;
  /** Why a rule blocks it; the pill is then listed but cannot be pressed. */
  blockedReason?: string | undefined;
}

/**
 * The most characters two pills may hold together and still sit beside the cover on a phone, the
 * price beside them: "Kjøp" + "Avbestill", "Lever inn" + "Kanseller".
 */
const BESIDE_COVER_MAX_CHARS = 20;

/** The way's own icon in its colour, as big as a radio dot: outlined, filled once chosen. */
function ChoiceMark({ choice, checked }: { choice: CartLineChoice; checked: boolean }) {
  const { icon: Mark, color } = choice.appearance;
  return (
    <ThemeIcon
      className={classes.mark}
      variant={checked ? "filled" : "outline"}
      color={color}
      size="1.1rem"
      radius="xl"
      aria-hidden
    >
      <Mark size={11} />
    </ThemeIcon>
  );
}

/**
 * The pills in one row that wraps, with `end` (the price) closing it: pushed to its right edge
 * when there is room beside the last pill, on a line of its own at the right when there is not.
 */
function Choices({
  id,
  choices,
  selectedKey,
  end,
  onSelect,
}: {
  id: string;
  choices: CartLineChoice[];
  selectedKey: string | null;
  end: ReactNode;
  onSelect: (key: string) => void;
}) {
  const blocked = choices.filter((choice) => choice.blockedReason);
  return (
    <fieldset className={classes.choices} aria-labelledby={`${id}-title`}>
      <div className={classes.choiceRow}>
        {choices.map((choice) => (
          <label key={choice.key} className={classes.choice}>
            <input
              type="radio"
              className={classes.choiceInput}
              name={`${id}-choice`}
              checked={choice.key === selectedKey}
              disabled={choice.blockedReason !== undefined}
              onChange={() => onSelect(choice.key)}
            />
            <ChoiceMark choice={choice} checked={choice.key === selectedKey} />
            <span className={classes.choiceText}>{choice.label}</span>
          </label>
        ))}
        {end}
      </div>
      {blocked.length > 0 && (
        <ul className={classes.blocked}>
          {blocked.map((choice) => (
            <li key={choice.key}>
              {choice.label}: {choice.blockedReason}
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

/**
 * One book in a cart, the public cart's and Kasse's alike. A line with one way says it under the
 * title, its price at the cover's foot; more ways become pills, the price closing their last row,
 * so the price is always the card's last thing on the right. `readOnly` keeps only the chosen way,
 * for a line whose only step is to remove it.
 */
export default function CartLineCard({
  title,
  isbn,
  details,
  choices,
  selectedKey,
  readOnly = false,
  onSelect,
  price,
  notice,
  warn = false,
  onRemove,
}: {
  title: string;
  isbn: Isbn;
  /** Under the way: what the employee needs to know about the copy. */
  details?: ReactNode;
  choices: CartLineChoice[];
  /** Null when the line's choice is no longer offered, so it visibly asks to be chosen again. */
  selectedKey: string | null;
  readOnly?: boolean;
  onSelect: (key: string) => void;
  /** What the chosen way costs now and later; null hides the price. */
  price: { now: number; later?: number | undefined } | null;
  /** What stops the line as it stands. */
  notice?: ReactNode;
  /** Washes the card amber: the line blocks the order. */
  warn?: boolean;
  onRemove: () => void;
}) {
  const id = useId();
  const selected = choices.find((choice) => choice.key === selectedKey);
  // One way says it under the title; more are pills to press. Two short pills fit beside the cover
  // even on a phone; longer or more take the card's full width there
  const asPills = !readOnly && choices.length > 1;
  const short =
    choices.length === 2 &&
    choices.reduce((sum, choice) => sum + choice.label.length, 0) <= BESIDE_COVER_MAX_CHARS;
  const pillsAt = !asPills ? undefined : short ? "beside" : "under";
  const priceTag = price && (
    <div className={classes.price}>
      <span className={classes.priceNow} data-refund={price.now < 0 || undefined}>
        {signedKroner(price.now)}
      </span>
      {price.later !== undefined && price.later > 0 && (
        <span className={classes.priceLater}>+ {signedKroner(price.later)} senere</span>
      )}
    </div>
  );
  return (
    <li className={classes.line} data-warn={warn || undefined}>
      <div className={classes.grid} data-choices={pillsAt}>
        <span className={classes.cover} aria-hidden>
          <BookCoverArt title={title} isbn={isbn} />
        </span>
        <div className={classes.info}>
          <div className={classes.head}>
            <h3 className={classes.title} id={`${id}-title`}>
              {title}
            </h3>
            <ActionIcon
              className={classes.remove}
              variant="subtle"
              color="gray"
              aria-label={`Fjern «${title}» fra handlekurven`}
              onClick={onRemove}
            >
              <IconX size={18} aria-hidden />
            </ActionIcon>
          </div>
          {!asPills && selected && <p className={classes.subtitle}>{selected.label}</p>}
          {details && <div className={classes.details}>{details}</div>}
        </div>
        {!asPills && priceTag}
        {notice && (
          <div className={classes.notice} role="status">
            <IconAlertTriangle size={18} aria-hidden />
            <div>{notice}</div>
          </div>
        )}
        {asPills && (
          <Choices
            id={id}
            choices={choices}
            selectedKey={selectedKey}
            end={priceTag}
            onSelect={onSelect}
          />
        )}
      </div>
    </li>
  );
}
