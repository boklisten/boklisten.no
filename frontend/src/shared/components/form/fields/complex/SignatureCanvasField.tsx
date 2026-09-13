import { ActionIcon, Box, Stack, Text, Tooltip } from "@mantine/core";
import { IconEraser } from "@tabler/icons-react";
import { Activity, useEffect, useEffectEvent, useRef } from "react";
import type { CSSProperties } from "react";
import SignaturePad from "signature_pad";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { useFieldContext } from "@/shared/hooks/form";

/** The box the customer draws in. Shared so illustrations of the signing step look the same. */
export const SIGNATURE_BOX_STYLE: CSSProperties = {
  border: "2px solid gray",
  borderRadius: 5,
  aspectRatio: 3,
  position: "relative",
};

const PNG_DATA_URL_HEADER = "data:image/png;base64,";

export default function SignatureCanvasField(props: { label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad>(null);
  const field = useFieldContext<string>();

  const onStrokeEnd = useEffectEvent(() => {
    const dataUrl = padRef.current?.toDataURL("image/png") ?? "";
    field.setValue(dataUrl.slice(PNG_DATA_URL_HEADER.length));
  });
  const clearField = useEffectEvent(() => field.setValue(""));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const pad = new SignaturePad(canvas);
    padRef.current = pad;
    pad.addEventListener("endStroke", onStrokeEnd);

    // The bitmap has to match the box, and changing it wipes the drawing, so only a change in
    // width counts: on phones the toolbar sliding away changes the height mid-signature.
    let bitmapWidth = 0;
    const fitCanvasToBox = () => {
      const { offsetWidth, offsetHeight } = canvas;
      if (offsetWidth === bitmapWidth) {
        return;
      }
      bitmapWidth = offsetWidth;
      canvas.width = offsetWidth;
      canvas.height = offsetHeight;
      pad.clear();
      clearField();
    };
    fitCanvasToBox();
    const observer = new ResizeObserver(fitCanvasToBox);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      pad.off();
      padRef.current = null;
    };
  }, []);

  return (
    <Stack gap={5}>
      <Text size="sm" fw={500}>
        {props.label}
      </Text>
      <Box style={SIGNATURE_BOX_STYLE}>
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
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
              padRef.current?.clear();
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
