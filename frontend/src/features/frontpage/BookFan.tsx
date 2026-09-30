import { useId } from "react";

import { MOCK_BOOKS } from "@/features/bokflyt/mockBooks";
import type { MockBook } from "@/features/bokflyt/mockBooks";
import SvgBookCover from "@/features/bokflyt/SvgBookCover";
import classes from "@/features/frontpage/frontpage.module.css";

interface Placement {
  book: MockBook;
  x: number;
  y: number;
  rotate: number;
}

const COVER = { width: 150, height: 210 };

/**
 * Five covers laid out like books dropped on a desk, back to front. The titles are ones
 * privatister sit exams in.
 */
const FAN: Placement[] = [
  { book: MOCK_BOOKS.kraft1, x: 96, y: 214, rotate: -16 },
  { book: MOCK_BOOKS.gripTekstenVg3, x: 178, y: 196, rotate: -8 },
  { book: MOCK_BOOKS.tidslinjer1, x: 264, y: 188, rotate: 0 },
  { book: MOCK_BOOKS.religionOgEtikk, x: 350, y: 196, rotate: 8 },
  { book: MOCK_BOOKS.matematikkR2, x: 432, y: 214, rotate: 16 },
];

/** The books in the fan, for the front page route to preload their covers. */
export const FAN_BOOKS: MockBook[] = FAN.map((placement) => placement.book);

export default function BookFan() {
  const id = useId();
  const shadowId = `${id}-shadow`;
  const titles = FAN.map((placement) => placement.book.title).join(", ");

  return (
    <svg
      viewBox="0 0 528 360"
      className={classes.fan}
      role="img"
      aria-label={`Fem lærebøker lagt ut på et bord: ${titles}.`}
    >
      <defs>
        <filter id={shadowId} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#1f2d33" floodOpacity="0.22" />
        </filter>
      </defs>
      {FAN.map((placement) => (
        <g
          key={placement.book.isbn}
          transform={`translate(${placement.x} ${placement.y}) rotate(${placement.rotate})`}
          filter={`url(#${shadowId})`}
        >
          <SvgBookCover book={placement.book} width={COVER.width} height={COVER.height} />
        </g>
      ))}
    </svg>
  );
}
