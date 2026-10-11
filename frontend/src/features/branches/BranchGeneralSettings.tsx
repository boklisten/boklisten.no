import type { Branch } from "@boklisten/backend/shared/branch";
import { Button, Stack, TextInput } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import InheritedFieldCard from "@/features/branches/inheritance/InheritedFieldCard";
import { INHERITED_FIELDS, onOffLabel } from "@/features/branches/inheritance/inheritedFields";
import { ToneSwitch } from "@/features/branches/inheritance/tone";
import { commitValue, useAppForm, withFieldGroup } from "@/shared/hooks/form";
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

/** The text fields, shared by the editor and the create form. */
const BranchGeneralFields = withFieldGroup({
  defaultValues: EMPTY_FIELDS,
  render: ({ group }) => (
    <>
      <group.AppField
        name="name"
        validators={{
          onChange: ({ value }) => (value.trim().length === 0 ? "Fyll inn et navn" : undefined),
        }}
      >
        {(field) => (
          <field.TextField required label="Navn" placeholder="Flåklypa videregående skole" />
        )}
      </group.AppField>
      <group.AppField name="address">
        {(field) => <field.TextField label="Adresse" placeholder="Postboks 8, 1316 Eiksmarka" />}
      </group.AppField>
    </>
  ),
});

const GENERAL_FIELDS = {
  name: "name",
  address: "address",
} as const;

/**
 * Edits an existing branch with auto-save (no "Lagre" button), or creates one under
 * `parentBranch`, inheriting everything from it; the admin can move it on the Relasjoner tab
 * afterwards.
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

function EditBranch({ branch }: { branch: Branch }) {
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

  // The root is a scope, never a school customers order from: it is never visible to them, and
  // the backend refuses to make it so, so the switch is not offered there.
  return (
    <Stack>
      <BranchGeneralFields form={form} fields={GENERAL_FIELDS} />
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
      <TextInput label="Tilhører" value={parentBranch.name} readOnly />
      <BranchGeneralFields form={form} fields={GENERAL_FIELDS} />
      <form.AppForm>
        <form.ErrorSummary />
      </form.AppForm>
      <Button color="green" onClick={form.handleSubmit} loading={addBranchMutation.isPending}>
        Opprett
      </Button>
    </Stack>
  );
}
