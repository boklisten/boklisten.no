import { Box, Container, Stack, Text, Title } from "@mantine/core";

import OrderButton from "@/features/frontpage/OrderButton";

export function HeroImageBackground() {
  return (
    <Box
      style={{
        paddingTop: "2rem",
        paddingBottom: "4rem",
        borderBottom: "5px solid #283d3b",
        backgroundColor: "#26768f",
        backgroundImage:
          "linear-gradient(90deg, rgba(255, 255, 255, 0.07) 30%, transparent 30%), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 50%, transparent 50%), linear-gradient(90deg, transparent 50%, rgba(255, 255, 255, 0.1) 50%), linear-gradient(90deg, transparent 50%, rgba(255, 255, 255, 0.1) 50%)",
        backgroundSize: "110px, 90px, 70px, 43px",
      }}
    >
      <Stack align="center">
        <Title c="white" fw={800} style={{ fontSize: "40px" }}>
          Alltid riktig bok!{" "}
        </Title>

        <Container size={640}>
          <Text size="lg" c="white" ta="center">
            Vi i Boklisten.no er veldig opptatt av lærebøker, derfor vil vi gjøre det så enkelt som
            mulig for deg å få tak i dem.
          </Text>
        </Container>

        <OrderButton />
      </Stack>
    </Box>
  );
}
