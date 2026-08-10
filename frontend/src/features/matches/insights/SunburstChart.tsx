import { Box, Center, Text } from "@mantine/core";
import type { BranchHierarchyNode } from "@boklisten/backend/shared/match/match-statistics";

const SIZE = 420;
const CENTER = SIZE / 2;
const HOLE_RADIUS = 62;
const OUTER_RADIUS = SIZE / 2 - 6;
const GAP_DEGREES = 0.6;

// Distinct hues assigned at the first level below the root; descendants inherit
// their ancestor's hue and get lighter the deeper they sit.
const HUES = [
  "blue",
  "teal",
  "grape",
  "orange",
  "cyan",
  "pink",
  "lime",
  "indigo",
  "red",
  "violet",
  "green",
  "yellow",
];

interface Arc {
  path: string;
  color: string;
  textColor: string;
  label: string;
  tooltip: string;
  labelTransform: string | null;
}

function pointOnCircle(radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

function annularSector(innerR: number, outerR: number, startDeg: number, endDeg: number) {
  // Keep a hairline gap and avoid a degenerate full-circle single arc.
  const a0 = startDeg + GAP_DEGREES / 2;
  const a1 = Math.min(endDeg - GAP_DEGREES / 2, startDeg + 359.99);
  const largeArc = a1 - a0 > 180 ? 1 : 0;
  const oStart = pointOnCircle(outerR, a0);
  const oEnd = pointOnCircle(outerR, a1);
  const iEnd = pointOnCircle(innerR, a1);
  const iStart = pointOnCircle(innerR, a0);
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
    "Z",
  ].join(" ");
}

function maxDepthOf(nodes: BranchHierarchyNode[], depth = 0): number {
  return nodes.reduce((max, node) => Math.max(max, maxDepthOf(node.children, depth + 1)), depth);
}

function cssColor(hue: string, shade: number) {
  return `var(--mantine-color-${hue}-${shade})`;
}

export default function SunburstChart({ data }: { data: BranchHierarchyNode[] }) {
  const total = data.reduce((sum, node) => sum + node.students, 0);
  if (total === 0) return null;

  const depth = Math.max(1, maxDepthOf(data));
  const ringWidth = (OUTER_RADIUS - HOLE_RADIUS) / depth;
  const arcs: Arc[] = [];
  let nextHue = 0;

  const walk = (
    node: BranchHierarchyNode,
    level: number,
    startDeg: number,
    endDeg: number,
    inheritedHue: string,
    pathLabel: string,
  ) => {
    const hue = level === 0 ? "gray" : level === 1 ? HUES[nextHue++ % HUES.length]! : inheritedHue;
    const shade = level === 0 ? 5 : Math.max(3, 7 - (level - 1));
    const innerR = HOLE_RADIUS + level * ringWidth;
    const outerR = innerR + ringWidth;
    const span = endDeg - startDeg;
    const midDeg = startDeg + span / 2;
    const fullLabel = pathLabel ? `${pathLabel} ${node.name}` : node.name;
    const sharePercent = Math.round((node.students / total) * 100);

    // Draw a label only where the segment is comfortably large.
    const arcLength = (((outerR + innerR) / 2) * (span * Math.PI)) / 180;
    let labelTransform: string | null = null;
    if (arcLength > 34 && ringWidth > 15 && node.name.length <= 12) {
      const flip = midDeg > 180;
      const rotation = midDeg - 90 + (flip ? 180 : 0);
      const labelPoint = pointOnCircle((innerR + outerR) / 2, midDeg);
      labelTransform = `translate(${labelPoint.x} ${labelPoint.y}) rotate(${rotation})`;
    }

    arcs.push({
      path: annularSector(innerR, outerR, startDeg, endDeg),
      color: cssColor(hue, shade),
      textColor: shade >= 5 ? "#fff" : "var(--mantine-color-dark-7)",
      label: node.name,
      tooltip: `${fullLabel} — ${node.students} elever (${sharePercent} %)`,
      labelTransform,
    });

    // Children share this node's angular span, scaled by the parent's full count
    // so students that stop at this level simply leave the outer ring empty.
    let childStart = startDeg;
    for (const child of node.children) {
      const childSpan = (child.students / node.students) * span;
      walk(child, level + 1, childStart, childStart + childSpan, hue, fullLabel);
      childStart += childSpan;
    }
  };

  let rootStart = 0;
  for (const root of data) {
    const rootSpan = (root.students / total) * 360;
    walk(root, 0, rootStart, rootStart + rootSpan, "gray", "");
    rootStart += rootSpan;
  }

  return (
    <Center>
      <Box pos={"relative"} w={"100%"} maw={SIZE}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={"100%"} role={"img"}>
          {arcs.map((arc, index) => (
            <g key={index}>
              <path
                d={arc.path}
                fill={arc.color}
                stroke={"var(--mantine-color-body)"}
                strokeWidth={1}
              >
                <title>{arc.tooltip}</title>
              </path>
              {arc.labelTransform && (
                <text
                  transform={arc.labelTransform}
                  fill={arc.textColor}
                  fontSize={11}
                  textAnchor={"middle"}
                  dominantBaseline={"central"}
                  style={{ pointerEvents: "none" }}
                >
                  {arc.label}
                </text>
              )}
            </g>
          ))}
          <text
            x={CENTER}
            y={CENTER - 6}
            textAnchor={"middle"}
            fontSize={26}
            fontWeight={700}
            fill={"var(--mantine-color-text)"}
          >
            {total.toLocaleString("nb-NO")}
          </text>
          <text
            x={CENTER}
            y={CENTER + 16}
            textAnchor={"middle"}
            fontSize={12}
            fill={"var(--mantine-color-dimmed)"}
          >
            elever
          </text>
        </svg>
        <Text size={"xs"} c={"dimmed"} ta={"center"} mt={"xs"}>
          Midten viser øverste filialnivå, ytterringene nivåene under. Hold musepekeren over for
          detaljer.
        </Text>
      </Box>
    </Center>
  );
}
