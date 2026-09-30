import { Anchor, Box, Container, Group, Stack, Text } from "@mantine/core";
import type { MantineSpacing, StyleProp } from "@mantine/core";
import { IconBrandInstagram, IconMail, IconMapPin, IconPhone } from "@tabler/icons-react";
import { Image } from "@unpic/react";
import dayjs from "dayjs";
import type { ReactNode } from "react";

import classes from "@/features/layout/PublicPageFooter.module.css";
import TanStackAnchor from "@/shared/components/TanStackAnchor";
import { CONTACT_INFO, ORGANIZATION_NUMBER, SOCIAL_PROFILE_URLS } from "@/shared/utils/constants";

const PAGE_LINKS = [
  { label: "Bestill bøker", to: "/bestilling" },
  { label: "Generell informasjon", to: "/info/general" },
  { label: "Åpningstider", to: "/info/branch" },
  { label: "Kontaktinformasjon", to: "/info/contact" },
] as const;

const POLICY_LINKS = [
  { label: "Betingelser", to: "/info/policies/conditions" },
  { label: "Vilkår", to: "/info/policies/terms" },
  { label: "Personvernerklæring", to: "/info/policies/privacy" },
] as const;

const [INSTAGRAM_URL] = SOCIAL_PROFILE_URLS;

/** 912047385 → 912 047 385, the way Brønnøysund prints it. */
const formattedOrganizationNumber = ORGANIZATION_NUMBER.replaceAll(
  /(?<triplet>\d{3})(?=\d)/g,
  "$<triplet> ",
);

function ContactRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={classes.contactRow}>
      <span className={classes.contactIcon} aria-hidden>
        {icon}
      </span>
      <Stack gap={2}>
        <Text size="sm" c="inherit">
          {label}
        </Text>
        {children}
      </Stack>
    </div>
  );
}

export default function PublicPageFooter({ mt }: { mt?: StyleProp<MantineSpacing> }) {
  return (
    <Box component="footer" className={classes.footer} mt={mt}>
      <Container size="lg">
        <div className={classes.columns}>
          <Stack gap="md" className={classes.brand}>
            <TanStackAnchor to="/" underline="never" c="inherit">
              <Group gap="sm" wrap="nowrap">
                <Image
                  src="/images/boklisten_logo_white.webp"
                  width={36}
                  height={36}
                  alt="Boklisten.no"
                />
                <span className={classes.wordmark}>Boklisten.no</span>
              </Group>
            </TanStackAnchor>
            <Text className={classes.tagline}>Pensumbøker til videregående og privatister.</Text>
          </Stack>

          <nav aria-label="Sider">
            <p className={classes.heading}>Sider</p>
            <ul className={classes.list}>
              {PAGE_LINKS.map((link) => (
                <li key={link.to}>
                  <TanStackAnchor to={link.to} className={classes.link} underline="hover">
                    {link.label}
                  </TanStackAnchor>
                </li>
              ))}
              <li>
                <Anchor
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener"
                  className={classes.link}
                  underline="hover"
                >
                  <Group gap={6} wrap="nowrap" component="span">
                    <IconBrandInstagram size={18} aria-hidden />
                    Instagram
                  </Group>
                </Anchor>
              </li>
            </ul>
          </nav>

          <div>
            <p className={classes.heading}>Kontakt</p>
            <Stack gap="md">
              <ContactRow icon={<IconPhone size={20} />} label="Ring oss">
                <Anchor
                  href={`tel:${CONTACT_INFO.phone}`}
                  className={classes.contactValue}
                  underline="hover"
                >
                  {CONTACT_INFO.phone}
                </Anchor>
              </ContactRow>
              <ContactRow icon={<IconMail size={20} />} label="Send oss en e-post">
                <Anchor
                  href={`mailto:${CONTACT_INFO.email}`}
                  className={classes.contactValue}
                  underline="hover"
                >
                  {CONTACT_INFO.email}
                </Anchor>
              </ContactRow>
              <ContactRow icon={<IconMapPin size={20} />} label="Vår adresse">
                <Text className={classes.contactValue}>{CONTACT_INFO.address}</Text>
              </ContactRow>
            </Stack>
          </div>
        </div>

        <div className={classes.legal}>
          <div>
            <div>© {dayjs().format("YYYY")} Boklisten.no AS</div>
            <div>Organisasjonsnummer {formattedOrganizationNumber} MVA</div>
          </div>
          <div className={classes.legalLinks}>
            {POLICY_LINKS.map((link) => (
              <TanStackAnchor
                key={link.to}
                to={link.to}
                className={`${classes.link} ${classes.legalLink}`}
                size="sm"
                underline="hover"
              >
                {link.label}
              </TanStackAnchor>
            ))}
          </div>
          <div className={classes.supporter}>
            <span>Støttet av</span>
            <span className={classes.supporterBadge}>
              <Image
                className={classes.supporterLogo}
                src="/images/skattefunn.webp"
                alt="SkatteFUNN"
                width={57}
                height={32}
              />
            </span>
          </div>
        </div>
      </Container>
    </Box>
  );
}
