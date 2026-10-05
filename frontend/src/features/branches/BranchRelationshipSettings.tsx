import type { Branch } from "@boklisten/backend/shared/branch";
import { Loader, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { useAppForm } from "@/shared/hooks/form";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { api, apiClient } from "@/shared/utils/apiClient";

function valuesOf(branch: Branch, branches: Branch[]) {
  return {
    localName: branch.localName ?? "",
    parentBranchId: branch.parentBranchId ?? "",
    childBranchIds: branches.filter((b) => b.parentBranchId === branch.id).map((b) => b.id),
    childLabel: branch.childLabel ?? "",
  };
}

/** The children come from the other branches' parent references, so the form waits for them. */
export default function BranchRelationshipSettings({ branch }: { branch: Branch }) {
  const { data: branches } = useQuery(api.branches.index.queryOptions());
  return branches ? <RelationshipEditor branch={branch} branches={branches} /> : <Loader />;
}

function RelationshipEditor({ branch, branches }: { branch: Branch; branches: Branch[] }) {
  const branchOptions = branches
    .filter((b) => b.id !== branch.id)
    .map((b) => ({ value: b.id, label: b.name }));
  const form = useAppForm(
    useAutoSave({
      defaultValues: valuesOf(branch, branches),
      persist: (values) =>
        apiClient.api.branchRelationships.update({
          body: {
            id: branch.id,
            localName: values.localName || null,
            childLabel: values.childLabel || null,
            parentBranchId: values.parentBranchId || null,
            childBranchIds: values.childBranchIds,
          },
        }),
      invalidates: [api.branches.index.pathKey()],
    }),
  );

  return (
    <Stack>
      <form.AppField name="localName">
        {(field) => <field.TextField label="Lokalt navn" placeholder="Flåklypa" />}
      </form.AppField>
      <form.AppField name="parentBranchId">
        {(field) => (
          <field.SelectField
            label="Tilhører"
            placeholder="Velg filial"
            data={branchOptions}
            searchable
            clearable
          />
        )}
      </form.AppField>
      <form.AppField name="childLabel">
        {(field) => <field.TextField label="Delt inn i" placeholder="årskull, klasse, parallell" />}
      </form.AppField>
      <form.AppField name="childBranchIds">
        {(field) => (
          <field.MultiSelectField
            label="Består av"
            placeholder="Velg filialer"
            data={branchOptions}
            searchable
            clearable
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.ErrorSummary autoSave />
      </form.AppForm>
    </Stack>
  );
}
