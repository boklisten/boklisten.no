import { Button } from "@mantine/core";
import type { ButtonProps } from "@mantine/core";
import type { ReactNode } from "react";

/**
 * Vipps's brand palette for buttons, from their button library: orange at rest, lighter on hover,
 * darker while pressed or loading, grey when disabled, white text throughout.
 */
export const VIPPS_ORANGE = "#ff5b24";
const VIPPS_ORANGE_LIGHT = "#ff985f";
const VIPPS_ORANGE_DARK = "#db460f";
const VIPPS_GREY_30 = "#c9c6d7";

/** The official Vipps mark in the current text colour, sized like a Tabler icon. */
function VippsMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 14"
      width={size}
      height={(size * 14) / 16}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.8534 4.59892C11.8702 4.59892 12.7416 3.83825 12.7416 2.74489H12.7419C12.7419 1.65128 11.8702 0.890869 10.8534 0.890869C9.8368 0.890869 8.96564 1.65128 8.96564 2.74489C8.96564 3.83825 9.8368 4.59892 10.8534 4.59892ZM13.3225 7.59445C12.0635 9.21049 10.7323 10.3278 8.38428 10.3279C5.98851 10.3279 4.12419 8.90154 2.6719 6.80984C2.09078 5.9539 1.19517 5.76386 0.541469 6.21552C-0.0635844 6.64349 -0.208475 7.54682 0.347935 8.33143C2.35689 11.3504 5.1405 13.1091 8.38402 13.1091C11.3617 13.1091 13.6856 11.6831 15.5008 9.30582C16.1784 8.42645 16.1542 7.52313 15.5008 7.02383C14.8955 6.54796 13.9999 6.71508 13.3225 7.59445Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * A Mantine button in the shape of Vipps's own: their colours, the pill radius, the fixed 44px
 * height and 24px side padding, with the Vipps mark where the icon goes. Vipps's official button
 * only speaks its fixed set of captions (pay, buy, log in …), so actions it has no word for, like
 * a refund, get this instead: on-brand to look at, our own words on it.
 */
export default function VippsStyledButton({
  children,
  loading = false,
  disabled = false,
  onClick,
  ...props
}: Pick<ButtonProps, "fullWidth" | "mt" | "w"> & {
  children: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const background = loading ? VIPPS_ORANGE_DARK : disabled ? VIPPS_GREY_30 : VIPPS_ORANGE;
  return (
    <Button
      {...props}
      h={44}
      px={24}
      radius="xl"
      fw={600}
      fz="md"
      leftSection={<VippsMark />}
      loading={loading}
      disabled={disabled}
      loaderProps={{ type: "dots", color: "#ffffff" }}
      vars={() => ({
        root: {
          "--button-bg": background,
          "--button-hover": loading || disabled ? background : VIPPS_ORANGE_LIGHT,
          "--button-color": "#ffffff",
        },
      })}
      styles={{ root: { transition: "background-color 150ms ease" } }}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
