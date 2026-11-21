import { round } from "./geometry";

let context: CanvasRenderingContext2D | null = null;

function measureContext(): CanvasRenderingContext2D | null {
  if (context) return context;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  context = canvas.getContext("2d");
  return context;
}

export function measureTextMm(
  text: string,
  fontSizeMm: number,
  family: string,
  weight = 400,
): number {
  const ctx = measureContext();
  if (!ctx || !text) return 0;
  ctx.font = `${weight} 100px ${family}`;
  return (ctx.measureText(text).width * fontSizeMm) / 100;
}

export function measureSpacedTextMm(
  text: string,
  fontSizeMm: number,
  family: string,
  weight = 400,
  letterSpacingMm = 0,
): number {
  const chars = Array.from(text);
  return (
    measureTextMm(text, fontSizeMm, family, weight) +
    Math.max(0, chars.length - 1) * letterSpacingMm
  );
}

export interface FitArcOptions {
  maxSizeMm: number;
  minSizeMm: number;
  family: string;
  weight?: number;
  margin?: number;
  letterSpacingMm?: number;
}

export interface ArcFit {
  fontSizeMm: number;
  fitted: boolean;
}

export function fitArcFontSize(
  text: string,
  arcLengthMm: number,
  options: FitArcOptions,
): ArcFit {
  return fitLineFontSize(text, arcLengthMm, {
    ...options,
    margin: options.margin ?? 1.08,
  });
}

export interface FitLineOptions {
  maxSizeMm: number;
  minSizeMm: number;
  family: string;
  weight?: number;
  margin?: number;
  letterSpacingMm?: number;
}

export function fitLineFontSize(
  text: string,
  maxWidthMm: number,
  options: FitLineOptions,
): ArcFit {
  const margin = options.margin ?? 1;
  let size = options.maxSizeMm;
  while (size >= options.minSizeMm) {
    if (
      measureSpacedTextMm(
        text,
        size,
        options.family,
        options.weight,
        options.letterSpacingMm,
      ) *
        margin <=
      maxWidthMm
    ) {
      return { fontSizeMm: round(size, 2), fitted: true };
    }
    size = round(size - 0.1, 2);
  }
  return { fontSizeMm: options.minSizeMm, fitted: false };
}

