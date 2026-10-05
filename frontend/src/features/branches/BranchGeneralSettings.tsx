import type { Branch } from "@boklisten/backend/shared/branch";
import { BRANCH_VISIBILITIES } from "@boklisten/backend/shared/branch-visibility";
import type { BranchVisibility } from "@boklisten/backend/shared/branch-visibility";
import { Button, SegmentedControl, Stack } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { VISIBILITY_SEGMENTS, visibilityDescription } from "@/features/branches/branchVisibility";
import InheritedFieldCard from "@/features/branches/inheritance/InheritedFieldCard";
import { toneColor } from "@/features/branches/inheritance/tone";
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
  /** The branch's own visibility, or `null` to inherit its parent's. */
  visibility: BranchVisibility | null;
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
    visibility: branch.overrides.visibility,
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
 * Edits an existing branch with auto-save (no "Lagre" button), or creates one at the top of the
 * tree with the column defaults; the admin places it under a parent on the Relasjoner tab
 * afterwards.
 */
export default function BranchGeneralSettings({
  existingBranch,
  onSuccess,
}: {
  existingBranch?: Branch;
  onSuccess?: (newBranch?: Branch) => void;
}) {
  return existingBranch ? (
    <EditBranch branch={existingBranch} />
  ) : (
    <CreateBranch onSuccess={onSuccess} />
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

  return (
    <Stack>
      <BranchGeneralFields form={form} fields={GENERAL_FIELDS} />
      <form.AppField name="visibility">
        {(field) => (
          <InheritedFieldCard
            branchId={branch.id}
            field="visibility"
            tab="general"
            value={field.state.value}
            onChange={(value) => commitValue(field, value)}
            description={visibilityDescription}
          >
            {(value, setValue, tone) => (
              <SegmentedControl
                data={VISIBILITY_SEGMENTS}
                color={toneColor(tone)}
                value={value}
                onChange={(next) => setValue(parseVisibility(next))}
              />
            )}
          </InheritedFieldCard>
        )}
      </form.AppField>
      <form.AppForm>
        <form.ErrorSummary autoSave />
      </form.AppForm>
    </Stack>
  );
}

function CreateBranch({ onSuccess }: { onSuccess?: (newBranch?: Branch) => void }) {
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
      addBranchMutation.mutate({ body: { ...generalBody(value), parentBranchId: null } }),
  });

  return (
    <Stack>
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

function parseVisibility(value: string): BranchVisibility {
  const visibility = BRANCH_VISIBILITIES.find((candidate) => candidate === value);
  if (!visibility) {
    throw new TypeError(`Unknown visibility ${value}`);
  }
  return visibility;
}
