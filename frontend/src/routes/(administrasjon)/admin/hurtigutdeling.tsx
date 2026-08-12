import { Box, Button, Container, Stack, Title } from "@mantine/core";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import useApiClient from "@/shared/hooks/useApiClient";
import { modals } from "@mantine/modals";
import UserDetailSearchField from "@/features/rapid-handout/UserDetailSearchField";
import { IconUserEdit } from "@tabler/icons-react";
import UnlockUserMatchesButton from "@/features/matches/UnlockUserMatchesButton";
import AdministrateUserForm from "@/features/user/AdministrateUserForm";
import AdministrateUserSignatures from "@/features/signatures/AdministrateUserSignatures";
import RapidHandoutDetails from "@/features/rapid-handout/RapidHandoutDetails";
import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/shared/utils/seo";

export const Route = createFileRoute("/(administrasjon)/admin/hurtigutdeling")({
  head: () =>
    seo({
      title: "Hurtigutdeling | bl-admin",
    }),
  component: RapidHandoutPage,
});

function RapidHandoutPage() {
  const [userDetailsId, setUserDetailsId] = useState<string | null>(null);

  const { client, api } = useApiClient();
  const { data } = useQuery({
    queryKey: api.userDetail.getById.queryKey({ params: { detailsId: userDetailsId ?? "" } }),
    queryFn: async () =>
      userDetailsId
        ? client.api.userDetail.getById({ params: { detailsId: userDetailsId ?? "" } })
        : null,
  });

  return (
    <Container>
      <Stack>
        <Title>Hurtigutdeling</Title>
        <Stack>
          <UserDetailSearchField
            onSelectedResult={(userDetail) => {
              setUserDetailsId(userDetail?.id ?? null);
            }}
          />
          {data && (
            <Box>
              <Button
                leftSection={<IconUserEdit />}
                onClick={() =>
                  modals.open({
                    title: "Rediger brukerdetaljer",
                    children: (
                      <Stack>
                        <UnlockUserMatchesButton userDetailId={userDetailsId ?? ""} />
                        <AdministrateUserForm userDetail={data} />
                        <AdministrateUserSignatures userDetail={data} />
                      </Stack>
                    ),
                  })
                }
              >
                Rediger brukerdetaljer
              </Button>
            </Box>
          )}
          {data && <RapidHandoutDetails key={data.id} customer={data} />}
        </Stack>
      </Stack>
    </Container>
  );
}
