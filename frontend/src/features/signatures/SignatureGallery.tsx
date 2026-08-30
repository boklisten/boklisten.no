import {
  Badge,
  Box,
  Card,
  type CardProps,
  Center,
  Group,
  Image,
  Loader,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  useFocusWithin,
  useHover,
  useIntersection,
  useMergedRef,
  useReducedMotion,
} from "@mantine/hooks";
import { IconArrowRight } from "@tabler/icons-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createLink } from "@tanstack/react-router";
import { forwardRef, useEffect } from "react";

import type { UserPermission } from "@boklisten/backend/shared/user-permission";

import PermissionBadge from "@/features/rapid-handout/PermissionBadge";
import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import useApiClient from "@/shared/hooks/useApiClient";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

const GRID_COLS = { base: 1, xs: 2, md: 3, lg: 4, xl: 5 };

const CardAnchor = forwardRef<HTMLAnchorElement, Omit<CardProps, "component">>((props, ref) => (
  <Card ref={ref} component={"a"} {...props} />
));
const CardLink = createLink(CardAnchor);

interface GallerySignature {
  id: number;
  customerDetailsId: string;
  customerName: string;
  signingName: string;
  signedByGuardian: boolean;
  signedAtText: string;
  image: string;
  branchName: string | null;
  permission: UserPermission;
}

function SignatureCard({ signature }: { signature: GallerySignature }) {
  const { hovered, ref: hoverRef } = useHover<HTMLAnchorElement>();
  const { focused, ref: focusRef } = useFocusWithin<HTMLAnchorElement>();
  const still = useReducedMotion();
  const ease = still ? undefined : "200ms ease";
  const active = hovered || focused;
  const ref = useMergedRef(hoverRef, focusRef);

  return (
    <CardLink
      ref={ref}
      to={"/admin/hurtigutdeling"}
      search={{ kunde: signature.customerDetailsId }}
      aria-label={`Åpne ${signature.customerName} i hurtigutdeling`}
      withBorder
      radius={"md"}
      padding={"sm"}
      c={"var(--mantine-color-text)"}
      style={{
        borderColor: `var(--mantine-color-${active ? "brand-text" : "default-border"})`,
        boxShadow: active ? "var(--mantine-shadow-xs)" : "none",
        transition: ease && `box-shadow ${ease}, border-color ${ease}`,
        textDecoration: "none",
      }}
    >
      <Card.Section withBorder bg={"white"} p={"xs"} pos={"relative"}>
        <Image
          src={`data:image/webp;base64,${signature.image}`}
          alt={`Signatur fra ${signature.signingName}`}
          fit={"contain"}
          style={{ aspectRatio: "3 / 1" }}
        />
        <Text
          size={"xs"}
          c={"dimmed"}
          pos={"absolute"}
          right={6}
          bottom={4}
          px={4}
          style={{ backgroundColor: "rgba(255, 255, 255, 0.85)", borderRadius: 4 }}
        >
          {signature.signedAtText}
        </Text>
      </Card.Section>
      <Stack gap={4} pt={"sm"}>
        <Group justify={"space-between"} gap={"xs"} wrap={"nowrap"}>
          <Text size={"sm"} fw={600} truncate>
            {signature.customerName}
          </Text>
          <IconArrowRight
            size={16}
            aria-hidden
            style={{
              flexShrink: 0,
              opacity: active ? 1 : 0.35,
              color: active ? "var(--mantine-color-brand-text)" : "var(--mantine-color-dimmed)",
              transition: ease && `opacity ${ease}`,
            }}
          />
        </Group>
        {signature.signedByGuardian && (
          <Text size={"xs"} truncate>
            Signert av {signature.signingName}
          </Text>
        )}
        {(signature.branchName || signature.permission !== "customer") && (
          <Group gap={4}>
            {signature.branchName && (
              <Badge size={"sm"} variant={"light"}>
                {signature.branchName}
              </Badge>
            )}
            <PermissionBadge permission={signature.permission} size={"sm"} />
          </Group>
        )}
      </Stack>
    </CardLink>
  );
}

function GallerySkeleton() {
  return (
    <SimpleGrid cols={GRID_COLS} spacing={"md"}>
      {Array.from({ length: 10 }, (_, index) => (
        <Skeleton key={index} height={160} radius={"md"} />
      ))}
    </SimpleGrid>
  );
}

export default function SignatureGallery() {
  const { api } = useApiClient();
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetching, isFetchingNextPage } =
    useInfiniteQuery(
      api.signatures.gallery.infiniteQueryOptions(
        {},
        {
          pageParamKey: "cursor",
          initialPageParam: "",
          getNextPageParam: (lastPage) => lastPage.nextCursor,
        },
      ),
    );
  // The generous rootMargin starts fetching the next page well before the bottom is visible, so
  // scrolling normally never hits a loading state.
  const { ref: sentinelRef, entry } = useIntersection({ rootMargin: "1500px" });
  const nearingBottom = entry?.isIntersecting ?? false;

  useEffect(() => {
    if (nearingBottom && hasNextPage && !isFetching) void fetchNextPage();
  }, [nearingBottom, hasNextPage, isFetching, fetchNextPage]);

  const signatures = data?.pages.flatMap((page) => page.signatures) ?? [];

  return (
    <Stack>
      <Stack gap={4}>
        <Title>Signaturer</Title>
        <Text c={"dimmed"}>
          De nyeste gyldige signaturene, nyest først. Trykk på en signatur for å åpne kunden i
          hurtigutdeling.
        </Text>
      </Stack>
      {isLoading && <GallerySkeleton />}
      {isError && (
        <ErrorAlert title={"Klarte ikke laste signaturer"}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>
      )}
      {!isLoading && !isError && signatures.length === 0 && (
        <Text c={"dimmed"}>Ingen gyldige signaturer å vise.</Text>
      )}
      {signatures.length > 0 && (
        <SimpleGrid cols={GRID_COLS} spacing={"md"}>
          {signatures.map((signature) => (
            <SignatureCard key={signature.id} signature={signature} />
          ))}
        </SimpleGrid>
      )}
      <Box ref={sentinelRef} />
      {isFetchingNextPage && (
        <Center py={"md"}>
          <Loader size={"sm"} />
        </Center>
      )}
      {!isLoading && !isError && !hasNextPage && signatures.length > 0 && (
        <Text ta={"center"} c={"dimmed"} size={"sm"} py={"md"}>
          Ingen flere signaturer
        </Text>
      )}
    </Stack>
  );
}
