import { Center, Tabs, TabsList, TabsTab, Select, Box } from "@mantine/core";

import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { useLocation, useNavigate } from "@tanstack/react-router";

const tabs = [
  { label: "Generell informasjon", value: "/info/general" },
  { label: "Spørsmål og svar", value: "/info/faq" },
  { label: "For VGS-elever", value: "/info/pupils" },
  { label: "Skoler og åpningstider", value: "/info/branch" },
  {
    label: "Avtaler og betingelser",
    value: "/info/policies/conditions",
  },
  { label: "Om oss", value: "/info/about" },
  { label: "For skolekunder", value: "/info/companies" },
  { label: "Innkjøpsliste", value: "/info/buyback" },
  { label: "Kontakt oss", value: "/info/contact" },
] as const satisfies {
  label: string;
  value: `/info/${string}`;
}[];

const InfoPagesNavigation = () => {
  const navigate = useNavigate();
  const pathname = useLocation({
    select: (location) => location.pathname,
  });

  return (
    <Center>
      <Box visibleFrom="sm">
        <Tabs value={tabs.find((tab) => pathname.includes(tab.value))?.value ?? pathname}>
          <TabsList justify="center">
            {tabs.map((tab) => (
              <TanStackAnchor
                underline="never"
                c="var(--mantine-color-text)"
                key={tab.value}
                to={tab.value}
              >
                <TabsTab value={tab.value}>{tab.label}</TabsTab>
              </TanStackAnchor>
            ))}
          </TabsList>
        </Tabs>
      </Box>
      <Box hiddenFrom="sm">
        <Select
          data={tabs}
          label="Velg side"
          value={pathname}
          onChange={(value) => {
            if (!value) {
              return;
            }
            void navigate({ to: value });
          }}
        />
      </Box>
    </Center>
  );
};

export default InfoPagesNavigation;
