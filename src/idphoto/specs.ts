export const ID_PHOTO_DPI = 300;

export interface IdPhotoSpec {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
}

/** Common Chinese ID-photo sizes, in millimetres. */
export const ID_PHOTO_SPECS: IdPhotoSpec[] = [
  { id: "one", name: "一寸", widthMm: 25, heightMm: 35 },
  { id: "small-one", name: "小一寸", widthMm: 22, heightMm: 32 },
  { id: "big-one", name: "大一寸", widthMm: 33, heightMm: 48 },
  { id: "two", name: "二寸", widthMm: 35, heightMm: 49 },
  { id: "small-two", name: "小二寸", widthMm: 35, heightMm: 45 },
  { id: "big-two", name: "大二寸", widthMm: 35, heightMm: 53 },
];

export const DEFAULT_SPEC_ID = "one";

export function specById(id: string): IdPhotoSpec {
  return ID_PHOTO_SPECS.find((spec) => spec.id === id) ?? ID_PHOTO_SPECS[0];
}

export function mmToPx(mm: number): number {
  return Math.round((mm / 25.4) * ID_PHOTO_DPI);
}

export function specPixels(spec: IdPhotoSpec): {
  width: number;
  height: number;
} {
  return {
    width: mmToPx(spec.widthMm),
    height: mmToPx(spec.heightMm),
  };
}

export type BackgroundId = "white" | "blue" | "red" | "original";

export interface BackgroundPreset {
  id: BackgroundId;
  label: string;
  color: string | null;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "white", label: "白底", color: "#FFFFFF" },
  { id: "blue", label: "蓝底", color: "#438EDB" },
  { id: "red", label: "红底", color: "#D9001B" },
  { id: "original", label: "原背景", color: null },
];

export function backgroundById(id: BackgroundId): BackgroundPreset {
  return (
    BACKGROUND_PRESETS.find((preset) => preset.id === id) ??
    BACKGROUND_PRESETS[0]
  );
}

/** Six-inch photo paper, 6 × 4 inches, used for the print sheet. */
export const SHEET_PAPER = {
  widthMm: 152.4,
  heightMm: 101.6,
  marginMm: 4,
  gapMm: 3,
} as const;

export interface SheetPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SheetLayout {
  width: number;
  height: number;
  columns: number;
  rows: number;
  count: number;
  orientation: "landscape" | "portrait";
  placements: SheetPlacement[];
}

export function sheetLayout(spec: IdPhotoSpec): SheetLayout {
  const photo = specPixels(spec);
  const { marginMm, gapMm } = SHEET_PAPER;

  const candidates = [
    {
      orientation: "landscape" as const,
      widthMm: SHEET_PAPER.widthMm,
      heightMm: SHEET_PAPER.heightMm,
    },
    {
      orientation: "portrait" as const,
      widthMm: SHEET_PAPER.heightMm,
      heightMm: SHEET_PAPER.widthMm,
    },
  ].map((paper) => {
    const columns = Math.max(
      1,
      Math.floor(
        (paper.widthMm - 2 * marginMm + gapMm) / (spec.widthMm + gapMm),
      ),
    );
    const rows = Math.max(
      1,
      Math.floor(
        (paper.heightMm - 2 * marginMm + gapMm) / (spec.heightMm + gapMm),
      ),
    );
    return { ...paper, columns, rows, count: columns * rows };
  });

  const best = candidates.reduce((current, next) =>
    next.count > current.count ? next : current,
  );

  const startX =
    (best.widthMm -
      (best.columns * spec.widthMm + (best.columns - 1) * gapMm)) /
    2;
  const startY =
    (best.heightMm -
      (best.rows * spec.heightMm + (best.rows - 1) * gapMm)) /
    2;

  const placements: SheetPlacement[] = [];
  for (let row = 0; row < best.rows; row += 1) {
    for (let column = 0; column < best.columns; column += 1) {
      placements.push({
        x: mmToPx(startX + column * (spec.widthMm + gapMm)),
        y: mmToPx(startY + row * (spec.heightMm + gapMm)),
        width: photo.width,
        height: photo.height,
      });
    }
  }

  return {
    width: mmToPx(best.widthMm),
    height: mmToPx(best.heightMm),
    columns: best.columns,
    rows: best.rows,
    count: best.count,
    orientation: best.orientation,
    placements,
  };
}