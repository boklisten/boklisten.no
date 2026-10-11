import { Anchor, TreeSelect } from "@mantine/core";
import type { TreeSelectProps } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { commitValue, useFieldContext } from "@/shared/hooks/form";
import {
  getBranchNodeShortLabel,
  rootOf,
  toBranchTreeNodeData,
  withoutRoot,
} from "@/shared/utils/branchTree";
import { api } from "@/shared/utils/apiClient";

/**
 * A customer's school. The root is "no school": it is offered first, as a choice of its own, and
 * the field can never be cleared, so a customer either has a school or has chosen not to have one.
 */
export default function SelectBranchField({
  perspective,
  ...props
}: Omit<TreeSelectProps, "data"> & { perspective: string }) {
  const field = useFieldContext<string>();
  // The branches the viewer may see, plus the stored membership even when it is hidden from them,
  // so it still shows by name until they pick another. Only the stored value can be hidden (the
  // tree offers nothing else), so it is read once instead of refetching on every pick.
  // oxlint-disable-next-line react/hook-use-state -- never set again, so no setter
  const [include] = useState(field.state.value);
  const { data: branches } = useQuery(
    api.branches.index.queryOptions({ query: include ? { include } : {} }),
  );

  const subject = perspective === "personal" ? "din" : "kundens";
  // The root's own name is for Filialer; here it is the choice it stands for. It is a leaf of its
  // own above the rest (a parent node would only expand), so the companies become top-level nodes.
  const root = rootOf(branches ?? []);
  const data = [
    ...(root ? [{ value: root.id, label: "Ingen skole" }] : []),
    ...toBranchTreeNodeData(withoutRoot(branches ?? [])),
  ];

  return (
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
      data={data}
      renderNode={({ node, hasChildren }) => (hasChildren ? null : getBranchNodeShortLabel(node))}
      expandOnClick
      searchable
      nothingFoundMessage="Fant ingen skoler"
      allowDeselect={false}
      {...props}
      // Wait for the branch data to be present so we can render its name
      value={branches ? field.state.value : null}
      onChange={(value) => {
        if (value !== null) {
          commitValue(field, value);
        }
      }}
      onBlur={field.handleBlur}
      error={field.state.meta.errors.join(", ")}
    />
  );
}
