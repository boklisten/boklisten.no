import { Anchor, Button, Group, Stack, TreeSelect, type TreeSelectProps } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { useFieldContext } from "@/shared/hooks/form";
import { getBranchNodeShortLabel, toBranchTreeNodeData } from "@/shared/utils/branchTree";
import { publicApi } from "@/shared/utils/publicApiClient";

export default function SelectBranchField({
  perspective,
  ...props
}: Omit<TreeSelectProps, "data"> & { perspective: string }) {
  const field = useFieldContext<string | null>();
  const { data: branches } = useQuery(publicApi.branches.getAll.queryOptions());

  const subject = perspective === "personal" ? "din" : "kundens";

  return (
    <Stack gap={"xs"}>
      <TreeSelect
        label={"Skole"}
        placeholder={`Velg ${subject} skole`}
        description={
          <>
            Finner du ikke {subject} skole eller klasse? Ta kontakt på{" "}
            <Anchor underline={"never"} size={"xs"} href={"mailto:info@boklisten.no"}>
              info@boklisten.no
            </Anchor>
            , så hjelper vi deg!
          </>
        }
        data={toBranchTreeNodeData(branches ?? [])}
        renderNode={({ node, hasChildren }) => (hasChildren ? null : getBranchNodeShortLabel(node))}
        expandOnClick
        searchable
        nothingFoundMessage={"Fant ingen skoler"}
        clearable
        {...props}
        // Wait for the branch data to be present so we can render its name
        value={branches ? field.state.value : null}
        onChange={field.handleChange}
        onBlur={field.handleBlur}
        error={field.state.meta.errors.join(", ")}
      />
      <Group>
        <Button variant={"subtle"} size={"compact-sm"} onClick={() => field.handleChange(null)}>
          {perspective === "personal" ? "Jeg skal ikke ha bøker" : "Kunden skal ikke ha bøker"}
        </Button>
      </Group>
    </Stack>
  );
}
