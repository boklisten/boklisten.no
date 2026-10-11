import type { Branch } from "@boklisten/backend/shared/branch";
import { Loader, MultiSelect, Stack } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";

import { commitValue, useAppForm } from "@/shared/hooks/form";
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

/** Save as the form holds it. The root has no parent and gets none; nobody else can lose theirs. */
function bodyOf(branch: Branch, values: ReturnType<typeof valuesOf>) {
  return {
    id: branch.id,
    localName: values.localName || null,
    childLabel: values.childLabel || null,
    ...(values.parentBranchId ? { parentBranchId: values.parentBranchId } : {}),
    childBranchIds: values.childBranchIds,
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
  const isRoot = branch.parentBranchId === null;
  const currentChildIds = branches.filter((b) => b.parentBranchId === branch.id).map((b) => b.id);
  const form = useAppForm(
    useAutoSave({
      defaultValues: valuesOf(branch, branches),
      persist: (values) =>
        apiClient.api.branchRelationships.update({ body: bodyOf(branch, values) }),
      invalidates: [api.branches.index.pathKey()],
    }),
  );

  return (
    <Stack>
      <form.AppField name="localName">
        {(field) => <field.TextField label="Lokalt navn" placeholder="Flåklypa" />}
      </form.AppField>
      {!isRoot && (
        <form.AppField name="parentBranchId">
          {(field) => (
            <field.SelectField
              label="Tilhører"
              placeholder="Velg filial"
              data={branchOptions}
              searchable
              allowDeselect={false}
            />
          )}
        </form.AppField>
      )}
      <form.AppField name="childLabel">
        {(field) => <field.TextField label="Delt inn i" placeholder="årskull, klasse, parallell" />}
      </form.AppField>
      <form.Field name="childBranchIds">
        {(field) => (
          // A branch that is here stays here: the backend refuses to leave it without a parent,
          // so removing a chip would only fail. It is moved from its own Relasjoner tab instead.
          <MultiSelect
            label="Består av"
            description="Filialer som ligger her flyttes fra sin egen Relasjoner-fane."
            placeholder="Legg til filialer"
            data={branchOptions}
            searchable
            value={field.state.value}
            onChange={(value) => commitValue(field, [...new Set([...currentChildIds, ...value])])}
            onBlur={field.handleBlur}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      </form.Field>
      <form.AppForm>
        <form.ErrorSummary autoSave />
      </form.AppForm>
    </Stack>
  );
}
