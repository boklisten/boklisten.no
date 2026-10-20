import type { Branch } from "@boklisten/backend/shared/branch";
import { Button, Loader, MultiSelect, Stack } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import InheritedFieldCard from "@/features/branches/inheritance/InheritedFieldCard";
import { INHERITED_FIELDS, onOffLabel } from "@/features/branches/inheritance/inheritedFields";
import { ToneSwitch } from "@/features/branches/inheritance/tone";
import { commitValue, useAppForm } from "@/shared/hooks/form";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { api, apiClient } from "@/shared/utils/apiClient";
import { showErrorNotification, showSuccessNotification } from "@/shared/utils/notifications";

const BRANCHES_QUERY_KEY = api.branches.index.pathKey();

/** The fields a branch has at creation; the inherited ones come after it is placed in the tree. */
interface GeneralFieldValues {
  name: string;
  address: string;
}

interface GeneralValues extends GeneralFieldValues {
  /** Whether the branch itself is visible to customers, or `null` to inherit its parent's. */
  visibleToCustomers: boolean | null;
}

/** The request body: empty optional text fields mean "not set". */
function generalBody<Values extends GeneralFieldValues>({ name, address, ...rest }: Values) {
  return { ...rest, name, address: address || null };
}

const EMPTY_FIELDS: GeneralFieldValues = {
  name: "",
  address: "",
};

function valuesOf(branch: Branch): GeneralValues {
  return {
    name: branch.name,
    address: branch.address ?? "",
    visibleToCustomers: branch.overrides.visibleToCustomers,
  };
}

const NAME_VALIDATORS = {
  onChange: ({ value }: { value: string }) =>
    value.trim().length === 0 ? "Fyll inn et navn" : undefined,
};
const NAME_PLACEHOLDER = "Flåklypa videregående skole";
const ADDRESS_PLACEHOLDER = "Postboks 8, 1316 Eiksmarka";

function relationshipValuesOf(branch: Branch, branches: Branch[]) {
  return {
    localName: branch.localName ?? "",
    childBranchIds: branches.filter((b) => b.parentBranchId === branch.id).map((b) => b.id),
    childLabel: branch.childLabel ?? "",
  };
}

function relationshipBody(branch: Branch, values: ReturnType<typeof relationshipValuesOf>) {
  return {
    id: branch.id,
    localName: values.localName || null,
    childLabel: values.childLabel || null,
    childBranchIds: values.childBranchIds,
  };
}

/**
 * Edits an existing branch with auto-save (no "Lagre" button), together with its place in the
 * tree, or creates one under `parentBranch`, inheriting everything from it; the admin can move it
 * by adding it to another branch's "Består av" afterwards.
 */
export default function BranchGeneralSettings(
  props:
    | { existingBranch: Branch; parentBranch?: never; onSuccess?: never }
    | { existingBranch?: never; parentBranch: Branch; onSuccess?: (newBranch?: Branch) => void },
) {
  return props.existingBranch ? (
    <EditBranch branch={props.existingBranch} />
  ) : (
    <CreateBranch parentBranch={props.parentBranch} onSuccess={props.onSuccess} />
  );
}

/** The children come from the other branches' parent references, so the editor waits for them. */
function EditBranch({ branch }: { branch: Branch }) {
  const { data: branches } = useQuery(api.branches.index.queryOptions());
  return branches ? <BranchEditor branch={branch} branches={branches} /> : <Loader />;
}

/**
 * Two auto-saved forms, one per endpoint, with their fields interleaved: what the branch is called
 * and how it is divided first, then where it is and who sees it.
 */
function BranchEditor({ branch, branches }: { branch: Branch; branches: Branch[] }) {
  const form = useAppForm(
    useAutoSave({
      defaultValues: valuesOf(branch),
      persist: (values) =>
        apiClient.api.branches.update({
          params: { branchId: branch.id },
          body: generalBody(values),
        }),
      invalidates: [BRANCHES_QUERY_KEY],
    }),
  );
  const relationshipForm = useAppForm(
    useAutoSave({
      defaultValues: relationshipValuesOf(branch, branches),
      persist: (values) =>
        apiClient.api.branchRelationships.update({ body: relationshipBody(branch, values) }),
      invalidates: [BRANCHES_QUERY_KEY],
    }),
  );
  // The root is never anyone's child, so it is not offered.
  const childOptions = branches
    .filter((b) => b.id !== branch.id && b.parentBranchId !== null)
    .map((b) => ({ value: b.id, label: b.name }));
  const currentChildIds = branches.filter((b) => b.parentBranchId === branch.id).map((b) => b.id);

  // The root is a scope, never a school customers order from: it is never visible to them, and
  // the backend refuses to make it so, so the switch is not offered there.
  return (
    <Stack>
      <form.AppField name="name" validators={NAME_VALIDATORS}>
        {(field) => <field.TextField required label="Navn" placeholder={NAME_PLACEHOLDER} />}
      </form.AppField>
      <relationshipForm.AppField name="localName">
        {(field) => <field.TextField label="Lokalt navn" placeholder="Flåklypa" />}
      </relationshipForm.AppField>
      <relationshipForm.AppField name="childLabel">
        {(field) => <field.TextField label="Delt inn i" placeholder="årskull, klasse, parallell" />}
      </relationshipForm.AppField>
      <relationshipForm.Field name="childBranchIds">
        {(field) => (
          // A branch that is here stays here: the backend refuses to leave it without a parent,
          // so removing a chip would only fail. It moves by being added to another branch instead.
          <MultiSelect
            label="Består av"
            placeholder="Legg til filialer"
            data={childOptions}
            searchable
            value={field.state.value}
            onChange={(value) => commitValue(field, [...new Set([...currentChildIds, ...value])])}
            onBlur={field.handleBlur}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      </relationshipForm.Field>
      <form.AppField name="address">
        {(field) => <field.TextField label="Adresse" placeholder={ADDRESS_PLACEHOLDER} />}
      </form.AppField>
      {branch.parentBranchId !== null && (
        <form.AppField name="visibleToCustomers">
          {(field) => (
            <InheritedFieldCard
              branchId={branch.id}
              field="visibleToCustomers"
              tab="general"
              value={field.state.value}
              onChange={(value) => commitValue(field, value)}
            >
              {(value, setValue, tone) => (
                <ToneSwitch
                  checked={value}
                  onChange={setValue}
                  tone={tone}
                  label={onOffLabel(value)}
                  ariaLabel={INHERITED_FIELDS.visibleToCustomers.label}
                />
              )}
            </InheritedFieldCard>
          )}
        </form.AppField>
      )}
      <form.AppForm>
        <form.ErrorSummary autoSave />
      </form.AppForm>
      <relationshipForm.AppForm>
        <relationshipForm.ErrorSummary autoSave />
      </relationshipForm.AppForm>
    </Stack>
  );
}

function CreateBranch({
  parentBranch,
  onSuccess,
}: {
  parentBranch: Branch;
  onSuccess?: (newBranch?: Branch) => void;
}) {
  const queryClient = useQueryClient();

  const addBranchMutation = useMutation(
    api.branches.store.mutationOptions({
      onSettled: () => queryClient.invalidateQueries({ queryKey: BRANCHES_QUERY_KEY }),
      onSuccess: async (newBranch) => {
        showSuccessNotification("Filial ble opprettet!");
        await queryClient.invalidateQueries({ queryKey: BRANCHES_QUERY_KEY });
        onSuccess?.(newBranch);
      },
      onError: () => showErrorNotification("Klarte ikke opprette filial!"),
    }),
  );

  const form = useAppForm({
    defaultValues: EMPTY_FIELDS,
    onSubmit: ({ value }) =>
      addBranchMutation.mutate({
        body: { ...generalBody(value), parentBranchId: parentBranch.id },
      }),
  });

  return (
    <Stack>
      <form.AppField name="name" validators={NAME_VALIDATORS}>
        {(field) => <field.TextField required label="Navn" placeholder={NAME_PLACEHOLDER} />}
      </form.AppField>
      <form.AppField name="address">
        {(field) => <field.TextField label="Adresse" placeholder={ADDRESS_PLACEHOLDER} />}
      </form.AppField>
      <form.AppForm>
        <form.ErrorSummary />
      </form.AppForm>
      <Button color="green" onClick={form.handleSubmit} loading={addBranchMutation.isPending}>
        Opprett
      </Button>
    </Stack>
  );
}
