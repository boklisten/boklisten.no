import BranchLocationInfo, { branchQueryOptions } from "@/features/info/BranchLocationInfo";
import BranchOpeningHours, {
  branchOpeningHoursQueryOptions,
} from "@/features/info/BranchOpeningHoursInfo";
import { jsonLdScript, seo } from "@/shared/utils/seo";
import { branchSchema } from "@/shared/utils/structuredData";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(offentlig)/info/branch/$branchId")({
  loader: async ({ context, params }) => {
    const [branch, openingHours] = await Promise.all([
      context.queryClient.query({ ...branchQueryOptions(params.branchId), staleTime: "static" }),
      context.queryClient.query({
        ...branchOpeningHoursQueryOptions(params.branchId),
        staleTime: "static",
      }),
    ]);
    return { branch, openingHours };
  },
  head: ({ loaderData, params }) => {
    const branchName = loaderData?.branch?.name;
    if (!branchName) {
      return seo({ title: "Åpningstider | Boklisten.no" });
    }

    const openingHours = loaderData?.openingHours ?? [];
    return {
      ...seo({
        title: `${branchName} – åpningstider | Boklisten.no`,
        description:
          openingHours.length > 0
            ? `Se når Boklisten står på stand ved ${branchName}, og når du kan hente og levere pensumbøker.`
            : `Åpningstider for henting og levering av pensumbøker ved ${branchName}.`,
      }),
      scripts: [
        jsonLdScript(
          branchSchema({
            branchName,
            address: loaderData?.branch?.location?.address,
            pathname: `/info/branch/${params.branchId}`,
            openingHours,
          }),
        ),
      ],
    };
  },
  component: BranchPage,
});

function BranchPage() {
  const { branchId } = Route.useParams();

  return (
    <>
      <BranchLocationInfo branchId={branchId} />
      <BranchOpeningHours branchId={branchId} />
    </>
  );
}
