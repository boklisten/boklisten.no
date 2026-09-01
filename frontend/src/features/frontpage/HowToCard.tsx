import { Card, Grid, Stack, Text, Title } from "@mantine/core";
import { Image } from "@unpic/react";

import Dots from "@/features/frontpage/Dots";

export default function HowToCard({
  image,
  title,
  description,
}: {
  image: string;
  title: string;
  description: string;
}) {
  return (
    <Stack gap={0} align="center" w="100%">
      <Dots />
      <Card withBorder shadow="md" radius="md" w="100%">
        <Grid align="center">
          <Grid.Col span={{ base: 12, xs: "content" }}>
            <Stack align="center">
              <Image src={image} alt={title} width={100} height={100} />
            </Stack>
          </Grid.Col>
          <Grid.Col span="auto">
            <Stack gap={5}>
              <Title order={2} ta={{ base: "center", xs: "left" }}>
                {title}
              </Title>
              <Text>{description}</Text>
            </Stack>
          </Grid.Col>
        </Grid>
      </Card>
    </Stack>
  );
}
