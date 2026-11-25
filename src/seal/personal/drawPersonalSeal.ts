import { fontFamily } from "../fonts";
import { personalSealLayout } from "../geometry";
import { applyCanvasAging } from "../aging";
import type { PersonalConfig } from "../types";

export interface PersonalDrawOptions {
  config: PersonalConfig;
  text: string;
  pxPerMm: number;
  background?: "transparent" | "white";
}

export function drawPersonalSeal(
  canvas: HTMLCanvasElement,
  options: PersonalDrawOptions,
): void {
  const { config, text, pxPerMm, background = "transparent" } = options;
  const size = config.size;
  const pixelSize = Math.max(1, Math.round(size * pxPerMm));

  canvas.width = pixelSize;
  canvas.height = pixelSize;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, pixelSize, pixelSize);
  context.scale(pxPerMm, pxPerMm);

  const center = size / 2;
  const border = config.border;
  const color = config.color;
  const isRound = config.shape === "round";

  const drawFrame = () => {
    context.beginPath();
    if (isRound) {
      context.arc(center, center, center - border / 2, 0, Math.PI * 2);
    } else {
      context.rect(
        border / 2,
        border / 2,
        size - border,
        size - border,
      );
    }
    context.lineWidth = border;
    context.strokeStyle = color;
    context.stroke();
  };

  if (config.carving === "bai") {
    context.beginPath();
    if (isRound) {
      context.arc(center, center, center - border / 2, 0, Math.PI * 2);
    } else {
      context.rect(
        border / 2,
        border / 2,
        size - border,
        size - border,
      );
    }
    context.fillStyle = color;
    context.fill();
  }

  const chars = Array.from(text);
  if (chars.length > 0) {
    const layout = personalSealLayout(chars, {
      size,
      border,
      shape: config.shape,
      textInset: config.textInset,
      glyphGap: config.glyphGap,
      layout: config.layout,
      fontSizeMode: config.fontSizeMode,
      fontSize: config.fontSize,
      offsetX: config.offsetX,
      offsetY: config.offsetY,
    });
    const cells = layout.cells;
    const family = fontFamily(config.fontId);

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = config.carving === "bai" ? "#000000" : color;
    context.globalCompositeOperation =
      config.carving === "bai" ? "destination-out" : "source-over";

    for (const cell of cells) {
      context.font = `${config.fontWeight} ${cell.fontSize}px ${family}`;
      context.fillText(cell.char, cell.x, cell.y);
    }

    context.globalCompositeOperation = "source-over";
  }

  drawFrame();

  applyCanvasAging(context, { amount: config.aging, pxPerMm });

  if (background === "white") {
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, size, size);
    context.globalCompositeOperation = "source-over";
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
}