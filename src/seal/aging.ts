export const AGING_SEED = 11;

export interface AgingFilterParams {
  frequency: number;
  octaves: number;
  seed: number;
  displacement: number;
  slope: number;
  intercept: number;
}

export function agingStrength(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value / 100));
}

// Maps the noise into a soft opacity range so the ink fades unevenly instead
// of being punched through. Low values stay nearly invisible; 100% leaves the
// stamp noticeably pale in irregular patches.
export function agingFilterParams(value: number): AgingFilterParams | null {
  const strength = agingStrength(value);
  if (strength <= 0) return null;
  return {
    frequency: 0.5,
    octaves: 4,
    seed: AGING_SEED,
    displacement: 0.5 * strength * strength,
    slope: 1.97 * strength,
    intercept: 1 - 1.32 * strength,
  };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (value: number) => value * value * (3 - 2 * value);

interface NoiseGrid {
  cell: number;
  columns: number;
  values: Float32Array;
}

function makeNoiseGrid(
  width: number,
  height: number,
  cell: number,
  random: () => number,
): NoiseGrid {
  const columns = Math.ceil(width / cell) + 2;
  const rows = Math.ceil(height / cell) + 2;
  const values = new Float32Array(columns * rows);
  for (let index = 0; index < values.length; index += 1) {
    values[index] = random();
  }
  return { cell, columns, values };
}

function sampleGrid(grid: NoiseGrid, x: number, y: number): number {
  const gx = x / grid.cell;
  const gy = y / grid.cell;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = smoothstep(gx - ix);
  const fy = smoothstep(gy - iy);
  const index = iy * grid.columns + ix;
  const top =
    grid.values[index] +
    (grid.values[index + 1] - grid.values[index]) * fx;
  const bottom =
    grid.values[index + grid.columns] +
    (grid.values[index + grid.columns + 1] -
      grid.values[index + grid.columns]) *
      fx;
  return top + (bottom - top) * fy;
}

export interface CanvasAgingOptions {
  amount: number;
  pxPerMm: number;
}

// Canvas equivalent of the SVG noise mask: multiplies the ink alpha by a
// deterministic value-noise field so both preview and PNG export show the
// same irregular fading.
export function applyCanvasAging(
  context: CanvasRenderingContext2D,
  options: CanvasAgingOptions,
): void {
  const strength = agingStrength(options.amount);
  if (strength <= 0) return;

  const width = context.canvas.width;
  const height = context.canvas.height;
  if (width === 0 || height === 0) return;

  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;
  const random = mulberry32(AGING_SEED);
  const coarse = makeNoiseGrid(
    width,
    height,
    Math.max(1.5, options.pxPerMm * 0.7),
    random,
  );
  const fine = makeNoiseGrid(
    width,
    height,
    Math.max(1.2, options.pxPerMm * 0.3),
    random,
  );
  const noiseAt = (x: number, y: number) =>
    0.7 * sampleGrid(coarse, x, y) + 0.3 * sampleGrid(fine, x, y);

  const probes = 128;
  const samples = new Float32Array(probes * probes);
  let cursor = 0;
  for (let y = 0; y < probes; y += 1) {
    for (let x = 0; x < probes; x += 1) {
      samples[cursor] = noiseAt(
        ((x + 0.5) / probes) * width,
        ((y + 0.5) / probes) * height,
      );
      cursor += 1;
    }
  }
  samples.sort();

  const span = Math.floor(samples.length * 0.8);
  const start = Math.floor(samples.length * 0.1);
  const low = samples[start];
  const high = samples[start + span];
  const floor = 1 - 0.65 * strength;
  const slope = (1 - floor) / Math.max(0.001, high - low);
  const intercept = 1 - slope * high;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4 + 3;
      if (pixels[index] === 0) continue;
      const keep = Math.min(
        1,
        Math.max(floor, noiseAt(x, y) * slope + intercept),
      );
      pixels[index] = Math.round(pixels[index] * keep);
    }
  }

  context.putImageData(image, 0, 0);
}