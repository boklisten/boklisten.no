import { Button, Stack } from "@mantine/core";

import InfoAlert from "@/shared/components/alerts/InfoAlert";
import { useAppForm } from "@/shared/hooks/form";
import {
  describeScanCodeFormat,
  determineScanCodeType,
  listScanCodeTypes,
  nameScanCodeType,
  type ScanCodeType,
} from "@/shared/utils/scanCodes";

function soleAcceptedType(accepts: ScanCodeType[] | undefined): ScanCodeType | null {
  return accepts?.length === 1 ? (accepts[0] ?? null) : null;
}

function validateCode(value: string, accepts: ScanCodeType[] | undefined): string | null {
  const code = value.trim();
  if (code.length === 0) {
    return "Du må fylle inn en kode";
  }
  if (accepts !== undefined && !accepts.includes(determineScanCodeType(code))) {
    return `Dette ser ikke ut som ${listScanCodeTypes(accepts)}`;
  }
  return null;
}

export default function ManualCodeEntry({
  accepts,
  onSubmit,
}: {
  accepts?: ScanCodeType[] | undefined;
  onSubmit: (code: string) => void | Promise<void>;
}) {
  const soleType = soleAcceptedType(accepts);
  const form = useAppForm({
    defaultValues: { code: "" },
    onSubmit: async ({ value }) => {
      await onSubmit(value.code.trim());
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <Stack>
        <InfoAlert>Skal kun brukes dersom koden ikke lar seg skanne</InfoAlert>
        <form.AppField
          name={"code"}
          validators={{ onSubmit: ({ value }) => validateCode(value, accepts) }}
        >
          {(field) => (
            <field.TextField
              required
              label={
                soleType === null ? "Skriv inn koden" : `Skriv inn ${nameScanCodeType(soleType)}`
              }
              placeholder={soleType === null ? "Kode" : describeScanCodeFormat(soleType)}
            />
          )}
        </form.AppField>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type={"submit"} loading={isSubmitting}>
              Bekreft
            </Button>
          )}
        </form.Subscribe>
      </Stack>
    </form>
  );
}
