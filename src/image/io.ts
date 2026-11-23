export type RasterFormat = "jpeg" | "png" | "webp";
export type SourceFormat =
  | RasterFormat
  | "gif"
  | "bmp"
  | "avif"
  | "other";

export const FORMAT_MIME: Record<RasterFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const FORMAT_EXT: Record<RasterFormat, "jpg" | "png" | "webp"> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export const formatLabel = (format: RasterFormat) =>
  format === "jpeg" ? "JPG" : format === "webp" ? "WebP" : "PNG";

export const sourceFormatLabel = (format: SourceFormat) =>
  format === "other" ? "图片" : format.toUpperCase();

const SUPPORTED_INPUT_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "avif",
]);

const EXTENSION_FORMAT: Record<string, SourceFormat> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  gif: "gif",
  bmp: "bmp",
  avif: "avif",
};

export function sourceFormatOf(file: File): SourceFormat {
  if (file.type === "image/jpeg") return "jpeg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/bmp") return "bmp";
  if (file.type === "image/avif") return "avif";

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_FORMAT[extension] ?? "other";
}

export function isSupportedRaster(file: File): boolean {
  if (SUPPORTED_INPUT_EXTENSIONS.has(file.name.split(".").pop()?.toLowerCase() ?? "")) {
    return true;
  }
  const format = sourceFormatOf(file);
  return format !== "other";
}

export function defaultOutputFormat(file: File): RasterFormat {
  const format = sourceFormatOf(file);
  return format === "jpeg" || format === "png" || format === "webp"
    ? format
    : "jpeg";
}

export async function decodeImage(file: File | Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      await image.decode();
      return await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: RasterFormat,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error(`当前环境不支持导出 ${formatLabel(format)}`)),
      FORMAT_MIME[format],
      format === "png" ? undefined : quality,
    );
  });
}

export function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function drawImage(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  width: number,
  height: number,
  background?: string | null,
) {
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
}

export const clampQuality = (quality: number) =>
  Math.min(1, Math.max(0.05, quality / 100));

export function outputFilename(
  original: string,
  suffix: string,
  format: RasterFormat,
): string {
  const dot = original.lastIndexOf(".");
  const raw = dot > 0 ? original.slice(0, dot) : original;
  const base =
    raw
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "图片";
  return `${base}${suffix}.${FORMAT_EXT[format]}`;
}

export const isHeic = (file: File) =>
  /\.(heic|heif)$/i.test(file.name) ||
  file.type === "image/heic" ||
  file.type === "image/heif";