import {
  canvasToBlob,
  clampQuality,
  decodeImage,
  makeCanvas,
  sourceFormatOf,
  type RasterFormat,
  type SourceFormat,
} from "./io";

export type CropRatio =
  | "original"
  | "1:1"
  | "4:3"
  | "3:4"
  | "16:9"
  | "9:16";

export type ResizeMode = "none" | "longest" | "percent";

export type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  sizePercent: number;
  opacity: number;
  color: string;
  position: WatermarkPosition;
  marginPercent: number;
  bold: boolean;
}

export interface EditSettings {
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  cropRatio: CropRatio;
  resizeMode: ResizeMode;
  longest: number | null;
  percent: number;
  format: "auto" | RasterFormat;
  quality: number;
  watermark: WatermarkSettings;
}

export interface EditResult {
  blob: Blob;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  format: RasterFormat;
  sourceFormat: SourceFormat;
}

export const DEFAULT_EDIT_SETTINGS: EditSettings = {
  rotate: 0,
  flipH: false,
  flipV: false,
  cropRatio: "original",
  resizeMode: "none",
  longest: 1920,
  percent: 100,
  format: "auto",
  quality: 90,
  watermark: {
    enabled: false,
    text: "内部资料",
    sizePercent: 4,
    opacity: 40,
    color: "#ffffff",
    position: "bottom-right",
    marginPercent: 4,
    bold: true,
  },
};

const RATIOS: Record<Exclude<CropRatio, "original">, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
};

export const outputFormatOf = (settings: EditSettings, source: SourceFormat): RasterFormat => {
  if (settings.format !== "auto") return settings.format;
  return source === "png" || source === "webp" || source === "jpeg"
    ? source
    : "jpeg";
};

function drawWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  watermark: WatermarkSettings,
) {
  if (!watermark.enabled || !watermark.text.trim()) return;

  const fontSize = Math.max(
    10,
    Math.round((width * watermark.sizePercent) / 100),
  );
  const margin = Math.max(0, (width * watermark.marginPercent) / 100);
  context.save();
  context.font = `${watermark.bold ? "600 " : ""}${fontSize}px "Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.globalAlpha = Math.min(1, Math.max(0.05, watermark.opacity / 100));
  context.fillStyle = watermark.color;
  context.shadowColor = "rgba(0, 0, 0, 0.28)";
  context.shadowBlur = Math.max(1, fontSize * 0.06);
  context.shadowOffsetX = 0;
  context.shadowOffsetY = Math.max(1, fontSize * 0.03);

  const textWidth = context.measureText(watermark.text).width;
  const column = watermark.position.endsWith("left")
    ? 0
    : watermark.position.endsWith("right")
      ? 2
      : 1;
  const row = watermark.position.startsWith("top")
    ? 0
    : watermark.position.startsWith("bottom")
      ? 2
      : 1;

  const x =
    column === 0
      ? margin
      : column === 1
        ? Math.max(margin, (width - textWidth) / 2)
        : width - margin - textWidth;
  const y =
    row === 0
      ? margin + fontSize / 2
      : row === 1
        ? height / 2
        : height - margin - fontSize / 2;

  context.fillText(watermark.text, x, y);
  context.restore();
}

export async function editImage(
  file: File,
  settings: EditSettings,
  isCurrent: () => boolean,
): Promise<EditResult> {
  const sourceFormat = sourceFormatOf(file);

  const bitmap = await decodeImage(file);
  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error("无法读取这张图片");
    }

    const ratio =
      settings.cropRatio === "original"
        ? null
        : RATIOS[settings.cropRatio];
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;
    if (ratio) {
      if (sourceWidth / sourceHeight > ratio) {
        cropWidth = Math.round(sourceHeight * ratio);
      } else {
        cropHeight = Math.round(sourceWidth / ratio);
      }
    }
    const cropX = Math.round((sourceWidth - cropWidth) / 2);
    const cropY = Math.round((sourceHeight - cropHeight) / 2);

    const cropped = makeCanvas(cropWidth, cropHeight);
    const cropContext = cropped.getContext("2d");
    if (!cropContext) throw new Error("无法创建画布");
    cropContext.imageSmoothingEnabled = true;
    cropContext.imageSmoothingQuality = "high";
    cropContext.drawImage(
      bitmap,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    );

    let scale = 1;
    if (settings.resizeMode === "longest" && settings.longest) {
      scale = Math.min(
        1,
        settings.longest / Math.max(cropWidth, cropHeight),
      );
    } else if (settings.resizeMode === "percent") {
      scale = Math.min(1, Math.max(0.05, settings.percent / 100));
    }

    const rotated = settings.rotate === 90 || settings.rotate === 270;
    const rotatedWidth = rotated ? cropHeight : cropWidth;
    const rotatedHeight = rotated ? cropWidth : cropHeight;
    const width = Math.max(1, Math.round(rotatedWidth * scale));
    const height = Math.max(1, Math.round(rotatedHeight * scale));

    const output = makeCanvas(width, height);
    const context = output.getContext("2d");
    if (!context) throw new Error("无法创建画布");
    const format = outputFormatOf(settings, sourceFormat);
    if (format === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate((settings.rotate * Math.PI) / 180);
    context.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
    context.drawImage(
      cropped,
      (-cropWidth * scale) / 2,
      (-cropHeight * scale) / 2,
      cropWidth * scale,
      cropHeight * scale,
    );
    context.restore();

    drawWatermark(context, width, height, settings.watermark);

    if (!isCurrent()) throw new Error("已取消");
    const blob = await canvasToBlob(
      output,
      format,
      format === "png" ? undefined : clampQuality(settings.quality),
    );
    if (!isCurrent()) throw new Error("已取消");

    return {
      blob,
      width,
      height,
      sourceWidth,
      sourceHeight,
      format,
      sourceFormat,
    };
  } finally {
    bitmap.close();
  }
}