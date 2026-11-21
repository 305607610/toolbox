export type CompressFormat = "auto" | "jpeg" | "webp" | "png";
export type OutputFormat = "jpeg" | "webp" | "png";

export interface CompressSettings {
  format: CompressFormat;
  /** Used when no target size is set. */
  quality: number;
  /** Longest allowed width in pixels; null means unrestricted. */
  maxWidth: number | null;
  /** Longest allowed height in pixels; null means unrestricted. */
  maxHeight: number | null;
  /** Hard upper bound for each output file; null means no target. */
  targetBytes: number | null;
}

export const DEFAULT_COMPRESS_SETTINGS: CompressSettings = {
  format: "auto",
  quality: 80,
  maxWidth: null,
  maxHeight: null,
  targetBytes: null,
};

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  format: OutputFormat;
  /** The original file was kept because re-encoding would not make it smaller. */
  usedOriginal: boolean;
}

const MIME: Record<OutputFormat, string> = {
  jpeg: "image/jpeg",
  webp: "image/webp",
  png: "image/png",
};

const EXTENSION: Record<OutputFormat, string> = {
  jpeg: "jpg",
  webp: "webp",
  png: "png",
};

const EXTENSION_TYPES: Record<string, OutputFormat> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
};

const MIN_QUALITY = 0.1;
const MAX_QUALITY = 1;
const MIN_DIMENSION = 16;

export const formatLabel = (format: OutputFormat) =>
  format === "jpeg" ? "JPG" : format === "webp" ? "WebP" : "PNG";

export const saveFormatOf = (format: OutputFormat) =>
  EXTENSION[format] as "jpg" | "webp" | "png";

function sourceFormatOf(file: File): OutputFormat | null {
  if (file.type === "image/jpeg") return "jpeg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? null;
}

export function isSupportedImage(file: File): boolean {
  return sourceFormatOf(file) !== null;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 100) return `${kb.toFixed(1).replace(/\.0$/, "")} KB`;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 100) return `${mb.toFixed(2).replace(/0$/, "").replace(/\.$/, "")} MB`;
  return `${Math.round(mb)} MB`;
}

export function outputFilename(original: string, format: OutputFormat): string {
  const dot = original.lastIndexOf(".");
  const raw = dot > 0 ? original.slice(0, dot) : original;
  const base =
    raw
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "图片";
  return `${base}_压缩.${EXTENSION[format]}`;
}

export function dedupeFilename(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let index = 2;
  while (used.has(`${base}-${index}${extension}`)) index += 1;
  const finalName = `${base}-${index}${extension}`;
  used.add(finalName);
  return finalName;
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
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

function encodeCanvas(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("当前环境不支持导出该格式")),
      mime,
      quality,
    );
  });
}

const clampQuality = (quality: number) =>
  Math.min(1, Math.max(0.05, quality / 100));

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Fits the image into the configured width/height box (never upscales), then
 * optionally reduces quality or further scales the image until it is no larger
 * than the target bytes. In target mode quality and dimensions are chosen
 * automatically, preferring the largest quality that still meets the target.
 */
export async function compressImage(
  file: File,
  settings: CompressSettings,
  isCurrent?: () => boolean,
): Promise<CompressResult> {
  const checkCancelled = () => {
    if (isCurrent && !isCurrent()) throw new Error("已取消");
  };

  const sourceFormat = sourceFormatOf(file);
  const targetFormat: OutputFormat =
    settings.format === "auto"
      ? sourceFormat === "jpeg"
        ? "jpeg"
        : "webp"
      : settings.format;

  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(file);
  } catch {
    throw new Error("无法读取这张图片");
  }

  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error("无法读取这张图片");
    }

    let scale = 1;
    if (settings.maxWidth && sourceWidth > settings.maxWidth) {
      scale = Math.min(scale, settings.maxWidth / sourceWidth);
    }
    if (settings.maxHeight && sourceHeight > settings.maxHeight) {
      scale = Math.min(scale, settings.maxHeight / sourceHeight);
    }

    const target =
      settings.targetBytes && settings.targetBytes > 0
        ? Math.round(settings.targetBytes)
        : null;
    const manualQuality = clampQuality(settings.quality);

    const canvas = document.createElement("canvas");
    const render = (width: number, height: number) => {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("无法创建画布");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (targetFormat === "jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }
      context.drawImage(bitmap, 0, 0, width, height);
      return canvas;
    };

    const encode = (quality?: number) =>
      encodeCanvas(
        canvas,
        MIME[targetFormat],
        targetFormat === "png" ? undefined : quality,
      );

    const result = (
      blob: Blob,
      width: number,
      height: number,
      usedOriginal = false,
    ): CompressResult => ({
      blob,
      width,
      height,
      sourceWidth,
      sourceHeight,
      format: usedOriginal && sourceFormat ? sourceFormat : targetFormat,
      usedOriginal,
    });

    // Already inside the requested size and no work is needed.
    if (
      target &&
      sourceFormat &&
      scale === 1 &&
      file.size <= target &&
      (settings.format === "auto" || sourceFormat === targetFormat)
    ) {
      return result(file, sourceWidth, sourceHeight, true);
    }

    if (!target) {
      checkCancelled();
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      render(width, height);
      const blob = await encode(manualQuality);
      checkCancelled();

      if (
        sourceFormat &&
        scale === 1 &&
        blob.size >= file.size &&
        (settings.format === "auto" || sourceFormat === targetFormat)
      ) {
        return result(file, sourceWidth, sourceHeight, true);
      }
      return result(blob, width, height);
    }

    let currentScale = scale;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      checkCancelled();
      const width = Math.max(1, Math.round(sourceWidth * currentScale));
      const height = Math.max(1, Math.round(sourceHeight * currentScale));
      if (width < MIN_DIMENSION || height < MIN_DIMENSION) break;

      render(width, height);

      if (targetFormat === "png") {
        const blob = await encode();
        checkCancelled();
        if (blob.size <= target) return result(blob, width, height);

        const factor = clamp(
          Math.sqrt(target / blob.size) * 0.94,
          0.25,
          0.9,
        );
        currentScale *= factor;
        continue;
      }

      const highest = await encode(MAX_QUALITY);
      checkCancelled();
      if (highest.size <= target) return result(highest, width, height);

      const lowest = await encode(MIN_QUALITY);
      checkCancelled();
      if (lowest.size <= target) {
        let low = MIN_QUALITY;
        let high = MAX_QUALITY;
        let best = lowest;
        for (let step = 0; step < 7; step += 1) {
          const mid = (low + high) / 2;
          const blob = await encode(mid);
          checkCancelled();
          if (blob.size <= target) {
            low = mid;
            best = blob;
          } else {
            high = mid;
          }
        }
        return result(best, width, height);
      }

      const factor = clamp(
        Math.sqrt(target / lowest.size) * 0.94,
        0.25,
        0.9,
      );
      currentScale *= factor;
    }

    throw new Error(`无法压到 ${formatBytes(target)}`);
  } finally {
    bitmap.close();
  }
}