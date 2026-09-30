import type { Branch } from "@boklisten/backend/shared/branch";
import { BRANCH_VISIBILITIES } from "@boklisten/backend/shared/branch-visibility";
import type { BranchVisibility } from "@boklisten/backend/shared/branch-visibility";
import { Button, SegmentedControl, Stack } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { VISIBILITY_SEGMENTS, visibilityDescription } from "@/features/branches/branchVisibility";
import InheritedFieldCard from "@/features/branches/inheritance/InheritedFieldCard";
import { toneColor } from "@/features/branches/inheritance/tone";
import { useAppForm, withFieldGroup } from "@/shared/hooks/form";
import useAutoSave from "@/shared/hooks/useAutoSave";
import { api } from "@/shared/utils/apiClient";
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
      <group.AppField name="name">
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
  const queryClient = useQueryClient();
  // The form starts from the branch as it was when the tab opened; the refetch after each save
  // must not reset what the admin is typing.
  // oxlint-disable-next-line react/hook-use-state -- never set again, so no setter
  const [initialValues] = useState(() => valuesOf(branch));

  const updateMutation = useMutation(api.branches.update.mutationOptions());
  const { save } = useAutoSave({
    initialBody: generalBody(initialValues),
    persist: (body) => updateMutation.mutateAsync({ params: { branchId: branch.id }, body }),
    notifications: {
      id: `branch-general-saved-${branch.id}`,
      saved: "Filialen ble lagret!",
      failed: "Klarte ikke lagre filialen",
    },
    onSaved: () => void queryClient.invalidateQueries({ queryKey: BRANCHES_QUERY_KEY }),
  });
  const form = useAppForm({
    defaultValues: initialValues,
    listeners: {
      onBlur: ({ fieldApi, formApi }) => {
        if (fieldApi.name !== "visibility") {
          saveIfValid(formApi.state.values);
        }
      },
      onChange: ({ fieldApi, formApi }) => {
        if (fieldApi.name === "visibility") {
          saveIfValid(formApi.state.values);
        }
      },
    },
  });

  function saveIfValid(values: GeneralValues) {
    if (values.name.trim().length === 0) {
      return;
    }
    save(generalBody(values));
  }

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
            onChange={field.handleChange}
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
