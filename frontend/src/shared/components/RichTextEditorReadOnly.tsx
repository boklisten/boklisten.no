import { Typography } from "@mantine/core";
import { FilterXSS, getDefaultWhiteList } from "xss";

const sanitizer = new FilterXSS({
  whiteList: {
    ...getDefaultWhiteList(),
    a: [...(getDefaultWhiteList().a ?? []), "rel"],
  },
});

export default function RichTextEditorReadOnly({ content }: { content: string }) {
  return (
    <Typography>
      <div dangerouslySetInnerHTML={{ __html: sanitizer.process(content) }} />
    </Typography>
  );
}
