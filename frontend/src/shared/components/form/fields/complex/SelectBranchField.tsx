import { Anchor, Button, Group, Stack, TreeSelect } from "@mantine/core";
import type { TreeSelectProps } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useFieldContext } from "@/shared/hooks/form";
import { getBranchNodeShortLabel, toBranchTreeNodeData } from "@/shared/utils/branchTree";
import { api } from "@/shared/utils/apiClient";

export default function SelectBranchField({
  perspective,
  ...props
}: Omit<TreeSelectProps, "data"> & { perspective: string }) {
  const field = useFieldContext<string | null>();
  // The branches the viewer may see, plus the stored membership even when it is hidden from them,
  // so it still shows by name until they pick another. Only the stored value can be hidden (the
  // tree offers nothing else), so it is read once instead of refetching on every pick.
  // oxlint-disable-next-line react/hook-use-state -- never set again, so no setter
  const [include] = useState(field.state.value);
  const { data: branches } = useQuery(
    api.branches.index.queryOptions({ query: include ? { include } : {} }),
  );

  const subject = perspective === "personal" ? "din" : "kundens";

  return (
    <Stack gap="xs">
      <TreeSelect
        label="Skole"
        placeholder={`Velg ${subject} skole`}
        description={
          <>
            Finner du ikke {subject} skole eller klasse? Ta kontakt på{" "}
            <Anchor underline="never" size="xs" href="mailto:info@boklisten.no">
              info@boklisten.no
            </Anchor>
            , så hjelper vi deg!
          </>
        }
        data={toBranchTreeNodeData(branches ?? [])}
        renderNode={({ node, hasChildren }) => (hasChildren ? null : getBranchNodeShortLabel(node))}
        expandOnClick
        searchable
        nothingFoundMessage="Fant ingen skoler"
        clearable
        {...props}
        // Wait for the branch data to be present so we can render its name
        value={branches ? field.state.value : null}
        onChange={field.handleChange}
        onBlur={field.handleBlur}
        error={field.state.meta.errors.join(", ")}
      />
      <Group>
        <Button variant="subtle" size="compact-sm" onClick={() => field.handleChange(null)}>
          {perspective === "personal" ? "Jeg skal ikke ha bøker" : "Kunden skal ikke ha bøker"}
        </Button>
      </Group>
    </Stack>
  );
}
