import { Box } from "@mantine/core";
import { useEffect } from "react";

import BL_CONFIG from "@/shared/utils/bl-config";
import loadScriptOnce from "@/shared/utils/loadScriptOnce";
import { apiClient } from "@/shared/utils/apiClient";
import { API_URL } from "@/shared/utils/env";
import { useLocation } from "@tanstack/react-router";

/** The official button's fixed height. */
const VIPPS_BUTTON_HEIGHT = 46;

/**
 * Vipps logs in, or creates the account on a first visit; the page says so beside the button.
 * The page's `redirect` (a path without its leading slash), or the one passed in, survives the
 * detour in localStorage.
 */
export default function VippsButton({ redirect }: { redirect?: string }) {
  const search = useLocation({ select: (location) => location.search });
  const target = redirect ?? search.redirect;

  useEffect(() => {
    loadScriptOnce("https://cdn.vippsmobilepay.com/js/button/button.js").catch(console.error);
  }, []);

  return (
    <Box
      // Holds the place until Vipps' script has drawn the button.
      mih={VIPPS_BUTTON_HEIGHT}
      onClick={() => {
        if (target) {
          localStorage.setItem(BL_CONFIG.login.localStorageKeys.redirect, target);
        }
        window.location.assign(API_URL + apiClient.urlFor("vipps.redirect"));
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
