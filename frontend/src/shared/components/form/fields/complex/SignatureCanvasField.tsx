import { ActionIcon, Box, Stack, Text, Tooltip } from "@mantine/core";
import { IconEraser } from "@tabler/icons-react";
import { Activity, useEffect, useEffectEvent, useRef } from "react";
import { SignatureCanvas } from "react-signature-canvas";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { useFieldContext } from "@/shared/hooks/form";

export default function SignatureCanvasField(props: { label: string }) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const field = useFieldContext<string>();

  const clearField = useEffectEvent(() => field.setValue(""));

  useEffect(() => {
    const resize = () => {
      if (!sigCanvas.current) {
        return;
      }
      const canvas = sigCanvas.current.getCanvas();
      const box = containerRef.current;
      if (canvas && box) {
        canvas.width = box.offsetWidth;
        canvas.height = box.offsetHeight;
        sigCanvas.current.clear();
        clearField();
      }
    };
    // Ensure everything is rendered properly before resize is called
    setTimeout(resize, 10);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <Stack gap={5}>
      <Text size="sm" fw={500}>
        {props.label}
      </Text>
      <Box
        ref={containerRef}
        style={{
          border: "2px solid gray",
          borderRadius: 5,
          aspectRatio: 3,
          position: "relative",
        }}
      >
        <SignatureCanvas
          onEnd={() => {
            if (!sigCanvas.current) {
              return;
            }
            const header = "data:image/png;base64,";
            const dataUrl = sigCanvas.current.toDataURL("image/png");
            field.setValue(dataUrl.slice(header.length));
          }}
          canvasProps={{
            style: { position: "absolute" },
          }}
          ref={sigCanvas}
        />
        <Tooltip label="Tøm">
          <ActionIcon
            aria-label="Tøm"
            color="dark"
            variant="subtle"
            pos="absolute"
            right={0}
            bottom={0}
            onClick={() => {
              sigCanvas.current?.clear();
              field.setValue("");
            }}
          >
            <IconEraser />
          </ActionIcon>
        </Tooltip>
      </Box>
      <Activity mode={field.state.meta.errors.length > 0 ? "visible" : "hidden"}>
        <ErrorAlert>{field.state.meta.errors.join(",")}</ErrorAlert>
      </Activity>
    </Stack>
  );
}
