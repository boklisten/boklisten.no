import { Button } from "@mantine/core";
import { preconnect } from "react-dom";

import { apiClient } from "@/shared/utils/apiClient";
import { API_URL } from "@/shared/utils/env";
import { VIPPS_ORANGE } from "@/shared/components/VippsStyledButton";
import { useLocation } from "@tanstack/react-router";

function VippsWordmark() {
  return (
    <svg
      aria-label="Vipps"
      role="img"
      viewBox="0 0 64 17"
      height={16}
      width={60}
      // The descenders of "pp" hang below the text's baseline, as on Vipps' own button.
      style={{ marginBottom: -2 }}
    >
      <path
        fillRule="evenodd"
        d="M64 5.38c-.72-2.75-2.47-3.84-4.86-3.84-1.93 0-4.36 1.1-4.36 3.72 0 1.7 1.18 3.03 3.09 3.37l1.81.32c1.23.23 1.58.7 1.58 1.32 0 .7-.76 1.1-1.89 1.1-1.48 0-2.4-.52-2.55-2l-2.61.41c.4 2.85 2.96 4.02 5.26 4.02 2.18 0 4.5-1.25 4.5-3.78 0-1.71-1.04-2.96-3-3.33l-1.99-.36c-1.11-.2-1.48-.75-1.48-1.27 0-.67.72-1.1 1.7-1.1 1.26 0 2.15.43 2.19 1.82l2.61-.4ZM5.92 9.7l2.72-7.86h3.19L7.1 13.5H4.73L0 1.84h3.19L5.92 9.7Zm16.69-4.52c0 .93-.74 1.57-1.6 1.57-.87 0-1.61-.64-1.61-1.57S20.14 3.6 21 3.6c.87 0 1.6.65 1.6 1.58Zm.5 4.12c-1.08 1.37-2.2 2.32-4.2 2.32-2.04 0-3.63-1.21-4.86-2.99-.5-.73-1.25-.89-1.81-.5-.51.36-.64 1.13-.16 1.8 1.7 2.56 4.07 4.05 6.83 4.05 2.53 0 4.5-1.2 6.04-3.23.58-.75.56-1.51 0-1.94-.51-.4-1.27-.26-1.85.49Zm7.09-1.66c0 2.38 1.4 3.64 2.96 3.64 1.48 0 3-1.17 3-3.64 0-2.42-1.52-3.6-2.98-3.6-1.58 0-2.98 1.12-2.98 3.6Zm0-4.18v-1.6h-2.9v15.68h2.9v-5.58a4.33 4.33 0 0 0 3.64 1.84c2.65 0 5.25-2.06 5.25-6.3 0-4.06-2.7-5.96-5-5.96-1.83 0-3.09.83-3.89 1.92Zm13.93 4.18c0 2.38 1.4 3.64 2.96 3.64 1.48 0 3-1.17 3-3.64 0-2.42-1.52-3.6-2.98-3.6-1.58 0-2.98 1.12-2.98 3.6Zm0-4.18v-1.6h-2.9v15.68h2.9v-5.58a4.33 4.33 0 0 0 3.64 1.84c2.65 0 5.24-2.06 5.24-6.3 0-4.06-2.7-5.96-5-5.96-1.83 0-3.08.83-3.88 1.92Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function VippsButton({ redirect }: { redirect?: string }) {
  const search = useLocation({ select: (location) => location.search });
  const target = redirect ?? search.redirect;
  const query = target ? `?${new URLSearchParams({ redirect: target })}` : "";

  preconnect("https://api.vipps.no");

  return (
    <Button
      component="a"
      href={API_URL + apiClient.urlFor("vipps.redirect") + query}
      fullWidth
      h={46}
      fw={600}
      fz={18}
      color={VIPPS_ORANGE}
    >
      <span>
        Logg inn med <VippsWordmark />
      </span>
    </Button>
  );
}
