import { createFileRoute } from "@tanstack/react-router";

import BokflytPage from "@/features/bokflyt/BokflytPage";
import { SITE_URL, seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/bokflyt")({
  head: () => ({
    ...seo({
      title: "Bokflyt – lærebøker rett fra elev til elev",
      description:
        "Bokflyt setter opp direkte overleveringer av lærebøker mellom elever ut fra fagvalg. Mindre logistikk for skolen, ingen lagring over sommeren, og elevene får bøkene før ferien.",
      image: `${SITE_URL}/images/bokflyt.png`,
    }),
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@600;700&display=swap",
      },
    ],
  }),
  component: BokflytPage,
});
