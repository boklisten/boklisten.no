import type { ComboboxItem, ComboboxParsedItem } from "@mantine/core";

/** The little a select needs to know about a book to be searched by title or ISBN. */
export interface SelectableItem {
  id: string;
  title: string;
  info: { isbn: number };
}

export function toItemSelectData(items: SelectableItem[] | undefined): ComboboxItem[] {
  return items?.map((item) => ({ label: item.title, value: item.id })) ?? [];
}

/**
 * Mantine select filter that matches on the visible title or on the book's ISBN, so an employee
 * can find a book by scanning or typing its barcode number.
 */
export function itemSelectFilter(items: SelectableItem[] | undefined) {
  return ({ options, search }: { options: ComboboxParsedItem[]; search: string }) => {
    const needle = search.toLowerCase().trim();
    return options.filter((option) => {
      if (!("value" in option)) {
        return false;
      }
      if (option.label.toLowerCase().trim().includes(needle)) {
        return true;
      }
      const isbn = items?.find((item) => item.id === option.value)?.info.isbn.toString();
      return isbn?.includes(needle) ?? false;
    });
  };
}
