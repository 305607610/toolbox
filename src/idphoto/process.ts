import {
  sheetLayout,
  specPixels,
  type IdPhotoSpec,
  type SheetLayout,
} from "./specs";

const WORK_MAX_EDGE = 1200;

/** Upper bound for an "original size" export, in pixels on the long edge. */
export const ORIGINAL_MAX_EDGE = 3000;

export interface PhotoAdjustments {
  /** 1 = cover the frame exactly. */
  zoom: number;
  /** Fractions of the output width/height. */
  offsetX: number;
  offsetY: number;
}

export interface ForegroundResult {
  canvas: HTMLCanvasElement | null;
  background: [number, number, number];
  fallback: boolean;
}

export interface SheetResult {
  canvas: HTMLCanvasElement;
  layout: SheetLayout;
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Builds a transparent-background cutout from a photo.
 *
 * The background colour is read from the top and upper sides, then a
 * region-growing pass (rather than a global colour key) removes only the
 * background connected to those edges. That keeps a white shirt from being
 * swallowed when it contrasts with the background.
 */
export function prepareForeground(
  bitmap: ImageBitmap,
  tolerance: number,
  feather: number,
  maxEdge = WORK_MAX_EDGE,
): ForegroundResult {
  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  const scale = Math.min(
    1,
    Math.max(1, maxEdge) / Math.max(sourceWidth, sourceHeight),
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const total = width * height;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return { canvas: null, background: [255, 255, 255], fallback: true };
  }

  // A white base keeps transparent source pixels neutral before keying.
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);

  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const analysis = analyzeBackground(data, width, height);
  const background = analysis.color;

  // A strict distance cap is what keeps a white shirt or a uniform hair mass
  // from being swallowed; neighbour similarity alone would leak into any
  // uniform region connected through a soft edge.
  const normalizedTolerance = clamp(tolerance, 0, 100) / 100;
  const cap =
    clamp(analysis.spread + 20, 24, 84) *
    (0.7 + normalizedTolerance * 0.6);
  const capSquared = cap * cap;

  const backgroundDistance = new Uint16Array(total);
  for (let index = 0; index < total; index += 1) {
    backgroundDistance[index] = distanceToColor(
      data,
      index * 4,
      background[0],
      background[1],
      background[2],
    );
  }

  const mask = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const seed = (index: number) => {
    if (mask[index] || backgroundDistance[index] > capSquared) return;
    mask[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    seed(x);
    if (height > 1) seed(width + x);
  }
  const sideLimit = Math.round(height * 0.68);
  for (let y = 1; y < sideLimit; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  if (tail === 0) {
    return { canvas: null, background, fallback: true };
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = (index - x) / width;

    if (x > 0) {
      const next = index - 1;
      if (!mask[next] && backgroundDistance[next] <= capSquared) {
        mask[next] = 1;
        queue[tail] = next;
        tail += 1;
      }
    }
    if (x + 1 < width) {
      const next = index + 1;
      if (!mask[next] && backgroundDistance[next] <= capSquared) {
        mask[next] = 1;
        queue[tail] = next;
        tail += 1;
      }
    }
    if (y > 0) {
      const next = index - width;
      if (!mask[next] && backgroundDistance[next] <= capSquared) {
        mask[next] = 1;
        queue[tail] = next;
        tail += 1;
      }
    }
    if (y + 1 < height) {
      const next = index + width;
      if (!mask[next] && backgroundDistance[next] <= capSquared) {
        mask[next] = 1;
        queue[tail] = next;
        tail += 1;
      }
    }
  }

  const removedRatio = tail / total;
  if (removedRatio < 0.004 || removedRatio > 0.985) {
    return { canvas: null, background, fallback: true };
  }

  // Choke the matte by a couple of working pixels: source antialiasing blends
  // subject and background into a light fringe that a binary mask would keep.
  const choked = dilateMask(mask, width, height, 2);
  const alpha = new Float32Array(total);
  for (let index = 0; index < total; index += 1) {
    alpha[index] = choked[index] ? 0 : 1;
  }

  const radius = clamp(
    Math.round((clamp(feather, 0, 6) * width) / 1000),
    0,
    12,
  );
  if (radius > 0) boxBlur(alpha, width, height, radius);

  const output = context.createImageData(width, height);
  const target = output.data;
  for (let index = 0; index < total; index += 1) {
    const raw = alpha[index];
    const value = raw * raw * (3 - 2 * raw);
    const pixel = index * 4;

    if (value <= 0.004) {
      target[pixel] = background[0];
      target[pixel + 1] = background[1];
      target[pixel + 2] = background[2];
      target[pixel + 3] = 0;
      continue;
    }

    if (value >= 0.996) {
      target[pixel] = data[pixel];
      target[pixel + 1] = data[pixel + 1];
      target[pixel + 2] = data[pixel + 2];
      target[pixel + 3] = 255;
      continue;
    }

    // Remove the old background's colour that bleeds into soft edges.
    const inverse = 1 - value;
    target[pixel] = clampColour(
      (data[pixel] - inverse * background[0]) / value,
    );
    target[pixel + 1] = clampColour(
      (data[pixel + 1] - inverse * background[1]) / value,
    );
    target[pixel + 2] = clampColour(
      (data[pixel + 2] - inverse * background[2]) / value,
    );
    target[pixel + 3] = Math.round(value * 255);
  }

  context.putImageData(output, 0, 0);
  return { canvas, background, fallback: false };
}

export function offsetBounds(
  image: { width: number; height: number },
  spec: IdPhotoSpec,
  zoom: number,
): { x: number; y: number } {
  const { width, height } = specPixels(spec);
  const cover = Math.max(width / image.width, height / image.height);
  const scale = cover * zoom;
  return {
    x: Math.max(0, (image.width * scale - width) / 2 / width),
    y: Math.max(0, (image.height * scale - height) / 2 / height),
  };
}

export interface ExportSize {
  width: number;
  height: number;
  /** Multiplier applied to the standard 300 DPI footprint. */
  scale: number;
  dpi: number;
}

/**
 * Uses the source pixels visible inside the current crop at 1:1. Never goes
 * below the standard 300 DPI size, and caps the long edge so a 48MP phone
 * photo cannot allocate a print-sized canvas that large.
 */
export function originalExportSize(
  image: { width: number; height: number },
  spec: IdPhotoSpec,
  zoom: number,
  maxEdge = ORIGINAL_MAX_EDGE,
): ExportSize {
  const base = specPixels(spec);
  const cover = Math.max(base.width / image.width, base.height / image.height);
  const sourcePixelsPerOutput = 1 / (cover * Math.max(1, zoom));
  const capScale = Math.max(
    1,
    Math.max(1, maxEdge) / Math.max(base.width, base.height),
  );
  const scale = clamp(
    Math.max(1, sourcePixelsPerOutput),
    1,
    capScale,
  );
  const width = Math.round(base.width * scale);
  const height = Math.round(base.height * scale);
  const dpi = Math.round(width / (spec.widthMm / 25.4));
  return { width, height, scale: width / base.width, dpi };
}

type SizedSource = CanvasImageSource & { width: number; height: number };

export function renderPhoto(
  source: SizedSource,
  spec: IdPhotoSpec,
  targetColour: string | null,
  adjustments: PhotoAdjustments,
  pixelScale = 1,
): HTMLCanvasElement {
  const base = specPixels(spec);
  const width = Math.max(1, Math.round(base.width * pixelScale));
  const height = Math.max(1, Math.round(base.height * pixelScale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return canvas;

  // An ID photo always needs an opaque background; white also covers
  // transparent source PNGs when the original background is kept.
  context.fillStyle = targetColour ?? "#FFFFFF";
  context.fillRect(0, 0, width, height);

  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const cover = Math.max(width / sourceWidth, height / sourceHeight);
  const scale = cover * Math.max(1, adjustments.zoom);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const maxX = Math.max(0, (drawWidth - width) / 2 / width);
  const maxY = Math.max(0, (drawHeight - height) / 2 / height);
  const offsetX = clamp(adjustments.offsetX, -maxX, maxX);
  const offsetY = clamp(adjustments.offsetY, -maxY, maxY);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    (width - drawWidth) / 2 + offsetX * width,
    (height - drawHeight) / 2 + offsetY * height,
    drawWidth,
    drawHeight,
  );

  return canvas;
}

export function renderSheet(
  photo: HTMLCanvasElement,
  spec: IdPhotoSpec,
): SheetResult {
  const layout = sheetLayout(spec);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d");
  if (!context) return { canvas, layout };

  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, layout.width, layout.height);

  for (const placement of layout.placements) {
    context.drawImage(
      photo,
      placement.x,
      placement.y,
      placement.width,
      placement.height,
    );
  }

  // Thin cut guides around each photo. 2px at 300 DPI is ~0.17mm.
  context.strokeStyle = "rgba(120, 124, 130, 0.45)";
  context.lineWidth = 2;
  for (const placement of layout.placements) {
    context.strokeRect(
      placement.x + 1,
      placement.y + 1,
      Math.max(1, placement.width - 2),
      Math.max(1, placement.height - 2),
    );
  }

  return { canvas, layout };
}

export function drawGuides(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const head = height * 0.08;
  const chin = height * 0.72;
  const centre = width / 2;

  context.save();
  context.lineCap = "round";

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  };

  context.setLineDash([]);
  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = 3.5;
  line(0, head, width, head);
  line(0, chin, width, chin);

  context.strokeStyle = "rgba(37, 99, 235, 0.92)";
  context.lineWidth = 1.6;
  context.setLineDash([7, 5]);
  line(0, head, width, head);
  line(0, chin, width, chin);

  context.globalAlpha = 0.55;
  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = 2.4;
  context.setLineDash([3, 6]);
  line(centre, 0, centre, height);

  context.strokeStyle = "rgba(37, 99, 235, 0.8)";
  context.lineWidth = 1.1;
  line(centre, 0, centre, height);
  context.globalAlpha = 1;

  const fontSize = Math.max(9, Math.round(width * 0.034));
  context.font = `600 ${fontSize}px "Segoe UI", "Microsoft YaHei UI", sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "center";
  drawLabel(context, "头顶", width - 10, head + 5, fontSize);
  drawLabel(context, "下巴", width - 10, chin + 5, fontSize);

  context.restore();
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  right: number,
  centreY: number,
  fontSize: number,
) {
  const paddingX = Math.round(fontSize * 0.45);
  const paddingY = Math.round(fontSize * 0.28);
  const textWidth = context.measureText(text).width;
  const width = textWidth + paddingX * 2;
  const height = fontSize + paddingY * 2;
  const x = right - width;
  const y = centreY - height / 2;

  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  context.beginPath();
  const radius = 3;
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height,
  );
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fill();

  context.fillStyle = "#1D4ED8";
  context.fillText(text, x + width / 2, centreY);
}

function analyzeBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { color: [number, number, number]; spread: number } {
  const buckets = new Map<
    number,
    { count: number; r: number; g: number; b: number }
  >();
  const samples: number[] = [];

  const add = (index: number) => {
    const pixel = index * 4;
    const r = data[pixel];
    const g = data[pixel + 1];
    const b = data[pixel + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
    samples.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    add(x);
    if (height > 1) add(width + x);
  }
  const sideLimit = Math.round(height * 0.68);
  for (let y = 2; y < sideLimit; y += 1) {
    add(y * width);
    add(y * width + width - 1);
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket;
  }

  if (!best || best.count === 0) {
    return { color: [255, 255, 255], spread: 0 };
  }

  const color: [number, number, number] = [
    Math.round(best.r / best.count),
    Math.round(best.g / best.count),
    Math.round(best.b / best.count),
  ];
  const distances = samples
    .map((index) =>
      Math.sqrt(
        distanceToColor(data, index * 4, color[0], color[1], color[2]),
      ),
    )
    .sort((a, b) => a - b);
  const spread =
    distances[
      Math.min(distances.length - 1, Math.floor(distances.length * 0.95))
    ] ?? 0;

  return { color, spread };
}

function distanceToColor(
  data: Uint8ClampedArray,
  pixel: number,
  r: number,
  g: number,
  b: number,
): number {
  const dr = data[pixel] - r;
  const dg = data[pixel + 1] - g;
  const db = data[pixel + 2] - b;
  return Math.round(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
}

function clampColour(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function dilateMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
) {
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x]) {
        output[y * width + x] = 1;
        continue;
      }
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      for (let row = top; row <= bottom; row += 1) {
        let found = false;
        for (let column = left; column <= right; column += 1) {
          if (mask[row * width + column]) {
            found = true;
            break;
          }
        }
        if (found) {
          output[y * width + x] = 1;
          break;
        }
      }
    }
  }
  return output;
}

function boxBlur(
  alpha: Float32Array,
  width: number,
  height: number,
  radius: number,
) {
  const temp = new Float32Array(alpha.length);
  const windowSize = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      sum += alpha[row + clamp(offset, 0, width - 1)];
    }
    for (let x = 0; x < width; x += 1) {
      temp[row + x] = sum / windowSize;
      sum -= alpha[row + clamp(x - radius, 0, width - 1)];
      sum += alpha[row + clamp(x + radius + 1, 0, width - 1)];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      sum += temp[clamp(offset, 0, height - 1) * width + x];
    }
    for (let y = 0; y < height; y += 1) {
      alpha[y * width + x] = sum / windowSize;
      sum -= temp[clamp(y - radius, 0, height - 1) * width + x];
      sum += temp[clamp(y + radius + 1, 0, height - 1) * width + x];
    }
  }
}

