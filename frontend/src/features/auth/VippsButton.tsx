import { Center } from "@mantine/core";
import { useEffect } from "react";

import BL_CONFIG from "@/shared/utils/bl-config";
import loadScriptOnce from "@/shared/utils/loadScriptOnce";
import { publicApiClient } from "@/shared/utils/publicApiClient";
import { useLocation, useNavigate } from "@tanstack/react-router";

export default function VippsButton({ verb }: { verb: "login" | "register" }) {
  const navigate = useNavigate();
  const search = useLocation({ select: (location) => location.search });

  useEffect(() => {
    loadScriptOnce("https://cdn.vippsmobilepay.com/js/button/button.js").catch(console.error);
  }, []);

  return (
    <Center
      onClick={() => {
        if (search.caller) {
          localStorage.setItem(BL_CONFIG.login.localStorageKeys.caller, search.caller);
        }
        if (search.redirect) {
          localStorage.setItem(BL_CONFIG.login.localStorageKeys.redirect, search.redirect);
        }
        void navigate({
          href: import.meta.env["VITE_API_URL"] + publicApiClient.urlFor("vipps.redirect"),
        });
      }}
    >
      {/* @ts-expect-error official Vipps button */}
      <vipps-mobilepay-button rounded="true" verb={verb} />
    </Center>
  );
}
