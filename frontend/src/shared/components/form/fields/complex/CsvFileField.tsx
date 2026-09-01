import { FileInput, Stack, Text } from "@mantine/core";
import type { FileInputProps } from "@mantine/core";
import { IconFileTypeCsv } from "@tabler/icons-react";
import Papa from "papaparse";
import { Activity, useState } from "react";

import { useFieldContext } from "@/shared/hooks/form";
import { showErrorNotification } from "@/shared/utils/notifications";

interface Header {
  label: string;
  required?: boolean;
}

export default function CsvFileField(
  props: Omit<FileInputProps, "multiple" | "accept"> & {
    headers: Header[];
  },
) {
  const field = useFieldContext<Record<string, string | string[]>[] | null>();
  const [value, setValue] = useState<File | null>(null);

  const requiredHeaders = props.headers
    .filter((header) => header.required)
    .map((header) => header.label);
  const optionalHeaders = props.headers
    .filter((header) => !header.required)
    .map((header) => header.label);
  const allHeaders = new Set([...requiredHeaders, ...optionalHeaders]);

  function parseRows(rows: string[][]): Record<string, string | string[]>[] | null {
    if (rows.length < 2) {
      showErrorNotification({
        title: "Valideringsfeil",
        message: "Filen har ingen data",
      });
      return null;
    }

    const headerRow = rows[0]?.map((h) => h.trim()) ?? [];
    const headerIndexMap: Record<string, number[]> = {};
    headerRow.forEach((headerName, i) => {
      if (allHeaders.has(headerName)) {
        headerIndexMap[headerName] ??= [];
        headerIndexMap[headerName].push(i);
      }
    });

    for (const header of requiredHeaders) {
      if (!headerIndexMap[header] || headerIndexMap[header].length === 0) {
        showErrorNotification({
          title: "Valideringsfeil",
          message: `Mangler kolonne: ${header}`,
        });
        return null;
      }
    }

    const parsedRows: Record<string, string | string[]>[] = [];

    for (let rowNumber = 1; rowNumber < rows.length; rowNumber++) {
      const row = rows[rowNumber] ?? [];
      const parsedRow: Record<string, string | string[]> = {};

      for (const header of requiredHeaders) {
        const indices = headerIndexMap[header] ?? [];
        const values = indices.map((i) => (row[i] ?? "").trim()).filter((v) => v !== "");

        if (values.length === 0) {
          showErrorNotification({
            title: "Valideringsfeil",
            message: `Rad nummer ${rowNumber + 1} mangler data for "${header}"`,
          });
          return null;
        }
        const firstValue = values[0];
        parsedRow[header] = values.length === 1 && firstValue ? firstValue : values;
      }

      for (const header of optionalHeaders ?? []) {
        const indices = headerIndexMap[header] ?? [];
        if (indices.length === 0) {
          continue;
        }

        const values = indices.map((i) => (row[i] ?? "").trim()).filter((v) => v !== "");

        const firstValue = values[0];
        if (firstValue) {
          parsedRow[header] = values.length === 1 ? firstValue : values;
        }
      }
      parsedRows.push(parsedRow);
    }

    return parsedRows;
  }
  const numberOfRowsParsed = (field.state.value ?? []).length;

  return (
    <Stack gap={5}>
      <FileInput
        clearable
        placeholder="Velg fil (csv)"
        accept="csv,text/csv"
        leftSection={<IconFileTypeCsv />}
        description={`Format: ${props.headers.map((header) => header.label).join(", ")}`}
        {...props}
        value={value}
        onChange={(file) => {
          if (!file) {
            setValue(null);
            field.handleChange(null);
            return;
          }

          const parseCsvText = (csvText: string) => {
            Papa.parse<string[]>(csvText, {
              header: false,
              skipEmptyLines: true,
              complete: ({ data, errors }) => {
                if (errors.length > 0) {
                  showErrorNotification({
                    title: "Klarte ikke lese CSV",
                    message: errors.map((error) => error.message).join(", "),
                  });
                  setValue(null);
                  field.handleChange(null);
                  return;
                }
                const parsedRows = parseRows(data);
                setValue(parsedRows ? file : null);
                field.handleChange(parsedRows);
              },
              error: (error: unknown) => {
                showErrorNotification({
                  title: "Klarte ikke lese CSV",
                  message: String(error),
                });
                setValue(null);
                field.handleChange(null);
              },
            });
          };
          file
            .text()
            .then(parseCsvText)
            .catch((error: unknown) => {
              showErrorNotification({
                title: "Klarte ikke lese CSV",
                message: error instanceof Error ? error.message : "Ukjent feil",
              });
              setValue(null);
              field.handleChange(null);
            });
        }}
        onBlur={field.handleBlur}
        error={field.state.meta.errors.join(", ")}
      />
      <Activity mode={numberOfRowsParsed > 0 ? "visible" : "hidden"}>
        <Text size="sm" fs="italic">
          Antall {typeof props.label === "string" ? props.label.toLowerCase() : "rader med data"}:{" "}
          {numberOfRowsParsed}
        </Text>
      </Activity>
    </Stack>
  );
}
