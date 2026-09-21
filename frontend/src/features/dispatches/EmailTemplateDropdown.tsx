import { Accordion, Button, Stack, Table } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/utils/apiClient";

export default function EmailTemplateDropdown() {
  const { data: emailTemplates } = useQuery(api.dispatch.emailTemplates.queryOptions());

  return (
    <Accordion>
      <Accordion.Item value="templates">
        <Accordion.Control>Tilgjengelige e-postmaler</Accordion.Control>
        <Accordion.Panel>
          <Stack align="center">
            <Table
              data={{
                head: ["Navn", "ID"],
                body:
                  emailTemplates?.map((emailTemplate) => [emailTemplate.name, emailTemplate.id]) ??
                  [],
              }}
            />
            <Button
              component="a"
              href="https://mc.sendgrid.com/dynamic-templates"
              target="_blank"
              rel="noreferrer"
              leftSection={<IconExternalLink />}
            >
              Administrer maler
            </Button>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
