import { Typography } from "@mantine/core";

/**
 * Renders stored rich-text HTML as-is. The HTML is authored only by admins in the
 * site-content editor (write routes are admin-guarded), so it is trusted and not sanitized.
 */
export default function RichTextEditorReadOnly({ content }: { content: string }) {
  return (
    <Typography>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </Typography>
  );
}
