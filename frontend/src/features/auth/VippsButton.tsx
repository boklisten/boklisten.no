import { Box } from "@mantine/core";
import { useEffect } from "react";
import { preconnect, preload } from "react-dom";

import loadScriptOnce from "@/shared/utils/loadScriptOnce";
import { apiClient } from "@/shared/utils/apiClient";
import { API_URL } from "@/shared/utils/env";
import { useLocation } from "@tanstack/react-router";

const VIPPS_BUTTON_SCRIPT = "https://cdn.vippsmobilepay.com/js/button/button.js";

/** The official button's fixed height. */
const VIPPS_BUTTON_HEIGHT = 46;

/**
 * Vipps logs in, or creates the account on a first visit; the page says so beside the button.
 * The page's `redirect` (a path without its leading slash), or the one passed in, goes to the API,
 * which sends the browser straight there once Vipps is done.
 */
export default function VippsButton({ redirect }: { redirect?: string }) {
  const search = useLocation({ select: (location) => location.search });
  const target = redirect ?? search.redirect;

  // Hints in the server's HTML: the script downloads alongside the page, and the browser is already
  // connected to Vipps when the API redirects there. The script still runs only after hydration,
  // so the button never shows before the click handler is attached.
  preload(VIPPS_BUTTON_SCRIPT, { as: "script" });
  preconnect("https://api.vipps.no");

  useEffect(() => {
    loadScriptOnce(VIPPS_BUTTON_SCRIPT).catch(console.error);
  }, []);

  return (
    <Box
      // Holds the place until Vipps' script has drawn the button.
      mih={VIPPS_BUTTON_HEIGHT}
      onClick={() => {
        const query = target ? `?${new URLSearchParams({ redirect: target })}` : "";
        window.location.assign(API_URL + apiClient.urlFor("vipps.redirect") + query);
      }}
    >
      {/* @ts-expect-error official Vipps button */}
      <vipps-mobilepay-button
        verb="login"
        language="no"
        // Full width with plain corners, like the site's own buttons.
        stretched="true"
        rounded="false"
        style={{ display: "block" }}
      />
    </Box>
  );
}
