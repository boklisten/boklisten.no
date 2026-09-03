import { Stack, Text, Title } from "@mantine/core";

import classes from "@/features/bokflyt/bokflyt.module.css";

export default function SectionHeading({ title, lead }: { title: string; lead?: string }) {
  return (
    <Stack gap="sm" mb={{ base: "xl", md: 48 }} maw={760}>
      <Title order={2} className={`${classes.display} ${classes.sectionTitle}`}>
        {title}
      </Title>
      {lead && <Text className={classes.lead}>{lead}</Text>}
    </Stack>
  );
}
