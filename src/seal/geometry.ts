export const MM_PER_INCH = 25.4;

export interface Point {
  x: number;
  y: number;
}

export interface PersonalCell {
  char: string;
  x: number;
  y: number;
  fontSize: number;
  row: number;
  col: number;
}

export interface PersonalLayoutOptions {
  size: number;
  border: number;
  shape: "square" | "round";
  textInset: number;
  glyphGap: number;
  layout: "auto" | "vertical" | "two-column";
  fontSizeMode: "auto" | "manual";
  fontSize: number;
  offsetX: number;
  offsetY: number;
}

export interface PersonalLayout {
  cells: PersonalCell[];
  autoFontSize: number;
  fontSize: number;
  overflow: boolean;
  inner: number;
}

export const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const mmToPx = (mm: number, dpi: number) => (mm / MM_PER_INCH) * dpi;

export function polar(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  degrees: number,
): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + rx * Math.cos(radians), y: cy + ry * Math.sin(radians) };
}

export function starPolygon(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points = 5,
  rotation = -Math.PI / 2,
): Point[] {
  const result: Point[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outerR : innerR;
    const angle = rotation + (index * Math.PI) / points;
    result.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return result;
}

export function starPointsString(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
): string {
  return starPolygon(cx, cy, outerR, innerR)
    .map((point) => `${round(point.x)},${round(point.y)}`)
    .join(" ");
}

export function arcPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startDeg: number,
  endDeg: number,
  sweep: 0 | 1,
): string {
  const start = polar(cx, cy, rx, ry, startDeg);
  const end = polar(cx, cy, rx, ry, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${round(start.x)} ${round(start.y)} A ${round(rx)} ${round(ry)} 0 ${largeArc} ${sweep} ${round(end.x)} ${round(end.y)}`;
}

export function sampledArcLength(
  rx: number,
  ry: number,
  startDeg: number,
  endDeg: number,
  samples = 180,
): number {
  let length = 0;
  let previous = polar(0, 0, rx, ry, startDeg);
  for (let index = 1; index <= samples; index += 1) {
    const angle = startDeg + ((endDeg - startDeg) * index) / samples;
    const point = polar(0, 0, rx, ry, angle);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

export const topArcPath = (cx: number, cy: number, rx: number, ry: number) =>
  arcPath(cx, cy, rx, ry, 200, 340, 1);

export const bottomArcPath = (cx: number, cy: number, rx: number, ry: number) =>
  arcPath(cx, cy, rx, ry, 160, 20, 0);

export const topArcLength = (rx: number, ry: number) =>
  sampledArcLength(rx, ry, 200, 340);

export const bottomArcLength = (rx: number, ry: number) =>
  sampledArcLength(rx, ry, 160, 20);

export const topArcPathSpan = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  spanDeg: number,
) => arcPath(cx, cy, rx, ry, 270 - spanDeg / 2, 270 + spanDeg / 2, 1);

export const bottomArcPathSpan = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  spanDeg: number,
) => arcPath(cx, cy, rx, ry, 90 + spanDeg / 2, 90 - spanDeg / 2, 0);

export const topArcLengthSpan = (
  rx: number,
  ry: number,
  spanDeg: number,
) => sampledArcLength(rx, ry, 270 - spanDeg / 2, 270 + spanDeg / 2);

export const bottomArcLengthSpan = (
  rx: number,
  ry: number,
  spanDeg: number,
) => sampledArcLength(rx, ry, 90 + spanDeg / 2, 90 - spanDeg / 2);

export function personalSealLayout(
  chars: string[],
  options: PersonalLayoutOptions,
): PersonalLayout {
  const {
    size,
    border,
    shape,
    textInset,
    glyphGap,
    fontSizeMode,
    fontSize,
    offsetX,
    offsetY,
  } = options;

  const usable = size - 2 * (border + textInset);
  const inner =
    Math.max(0, shape === "round" ? usable / Math.SQRT2 : usable);
  const cx = size / 2;
  const cy = size / 2;

  if (chars.length === 0) {
    return {
      cells: [],
      autoFontSize: 0,
      fontSize: 0,
      overflow: false,
      inner,
    };
  }

  const mode =
    options.layout === "auto"
      ? chars.length <= 3
        ? "vertical"
        : "two-column"
      : options.layout;
  const twoColumn = mode === "two-column";
  const rows = twoColumn ? Math.ceil(chars.length / 2) : chars.length;
  const cellWidth = twoColumn
    ? Math.max(0, (inner - glyphGap) / 2)
    : inner;
  const cellHeight = Math.max(
    0,
    (inner - glyphGap * (rows - 1)) / rows,
  );
  const autoFontSize = round(
    Math.max(0, Math.min(cellWidth * 0.88, cellHeight * 0.88)),
    2,
  );
  const usedFontSize =
    fontSizeMode === "auto" ? autoFontSize : Math.max(0, fontSize);
  const overflow =
    autoFontSize <= 0 ||
    (fontSizeMode === "manual" && usedFontSize > autoFontSize + 0.02);

  const top = cy + offsetY - inner / 2;
  const rightCount = Math.ceil(chars.length / 2);

  const cells: PersonalCell[] = chars.map((char, index) => {
    if (!twoColumn) {
      return {
        char,
        x: cx + offsetX,
        y: top + cellHeight * (index + 0.5),
        fontSize: usedFontSize,
        row: index,
        col: 0,
      };
    }

    const col = index < rightCount ? 0 : 1;
    const row = col === 0 ? index : index - rightCount;
    return {
      char,
      x:
        cx +
        offsetX +
        (col === 0 ? 1 : -1) * ((cellWidth + glyphGap) / 2),
      y: top + cellHeight * (row + 0.5),
      fontSize: usedFontSize,
      row,
      col,
    };
  });

  return {
    cells,
    autoFontSize,
    fontSize: usedFontSize,
    overflow,
    inner,
  };
}