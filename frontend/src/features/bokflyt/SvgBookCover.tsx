import { useId } from "react";

import { useBookCoverImage } from "@/features/book-cover/bookCoverQuery";
import type { MockBook } from "@/features/bokflyt/mockBooks";
import { BOKFLYT_COLORS } from "@/features/bokflyt/theme";

const { deep: DEEP, light: LIGHT } = BOKFLYT_COLORS;

/** The drawn fallback's proportions; the frames on the page are all roughly 3:4. */
const CHARS_PER_LINE = 6;
const MAX_LINES = 5;

/**
 * A small book cover for the SVG figures, centred on the origin. The real cover comes through
 * the product's own lookup; until it lands, and whenever it does not, a plain cover with the
 * title fills the same frame so nothing moves when the picture arrives.
 */
export default function SvgBookCover({
  book,
  width,
  height,
}: {
  book: MockBook;
  width: number;
  height: number;
}) {
  const { src, onError } = useBookCoverImage(book.isbn);
  const clipId = useId();
  const x = -width / 2;
  const y = -height / 2;
  const radius = Math.max(1.5, width / 12);

  return (
    <g>
      <title>{book.title}</title>
      <clipPath id={clipId}>
        <rect x={x} y={y} width={width} height={height} rx={radius} />
      </clipPath>
      <rect x={x} y={y} width={width} height={height} rx={radius} fill={DEEP} />
      {src === null ? (
        <FallbackCover x={x} y={y} width={width} height={height} title={book.title} />
      ) : (
        <image
          href={src}
          x={x}
          y={y}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
          onError={onError}
        />
      )}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={radius}
        fill="none"
        stroke="rgb(21 48 63 / 25%)"
        strokeWidth={1}
      />
    </g>
  );
}

/** A spine strip and the title in as many lines as fit. */
function FallbackCover({
  x,
  y,
  width,
  height,
  title,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
}) {
  const fontSize = width / 5.5;
  const lineHeight = fontSize * 1.15;
  const firstY = y + height * 0.22 + fontSize;
  return (
    <g>
      <rect x={x + width * 0.1} y={y} width={width * 0.1} height={height} fill={LIGHT} />
      {wrapTitle(title).map((line, index) => (
        <text
          key={`${index}-${line}`}
          x={x + width * 0.28}
          y={firstY + index * lineHeight}
          fontSize={fontSize}
          fontWeight={700}
          fontFamily="var(--bf-display)"
          fill="#ffffff"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

/** Greedy word wrap; a single overlong word is kept whole. */
function wrapTitle(title: string): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of title.split(" ")) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (candidate.length <= CHARS_PER_LINE || current === "") {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== "") {
    lines.push(current);
  }
  return lines.slice(0, MAX_LINES);
}
