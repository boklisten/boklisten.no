import BuybackList from "@/features/info/BuybackList";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/info/buyback")({
  head: () =>
    seo({
      title: "Innkjøpsliste | Boklisten.no",
      description:
        "Har du pensumbøker du ikke lenger trenger? Her er listen over bøkene Boklisten kjøper inn. Listen kan endre seg fortløpende.",
    }),
  component: BuybackPage,
});

function BuybackPage() {
  return <BuybackList />;
}
