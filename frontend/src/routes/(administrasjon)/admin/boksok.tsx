import { Container, Stack, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

import AdminBlidSearchResult from "@/features/blid-search/AdminBlidSearchResult";
import BlidSearchControls from "@/features/blid-search/BlidSearchControls";
import { isValidBlid } from "@/features/blid-search/validateBlid";
import { seo } from "@/shared/utils/seo";

type BoksokSearch = {
  blid?: string;
};

export const Route = createFileRoute("/(administrasjon)/admin/boksok")({
  validateSearch: (search: Record<string, unknown>): BoksokSearch => {
    // A pasted ?blid=88375301 reaches us as a number (TanStack parses search values as JSON).
    const raw = typeof search["blid"] === "number" ? String(search["blid"]) : search["blid"];
    return {
      blid: typeof raw === "string" && isValidBlid(raw) ? raw : undefined,
    };
  },
  head: () =>
    seo({
      title: "Boksøk | bl-admin",
    }),
  component: BoksokPage,
});

function BoksokPage() {
  const { blid } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <Container>
      <Stack>
        <Title>Boksøk</Title>
        <BlidSearchControls
          compact={blid !== undefined}
          instruction={"Skann bokas unike ID for å se hvem som har den"}
          onSubmit={(scanned) => void navigate({ search: { blid: scanned } })}
        />
        {blid !== undefined && (
          <AdminBlidSearchResult blid={blid} onClear={() => void navigate({ search: {} })} />
        )}
      </Stack>
    </Container>
  );
}
