import { Container, Stack, Title } from "@mantine/core";
import CartContent from "@/features/cart/CartContent";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(offentlig)/handlekurv")({
  head: () =>
    seo({
      title: "Handlekurv | Boklisten.no",
      description: "Se hvilke bøker du har lagt til i handlekurven din",
    }),
  component: CartPage,
});

function CartPage() {
  return (
    <Container size={"md"}>
      <Stack>
        <Title>Handlekurv</Title>
        <CartContent />
      </Stack>
    </Container>
  );
}
