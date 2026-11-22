import { insertPngDpi } from "../seal/png";
import { ID_PHOTO_DPI } from "./specs";

export type IdPhotoFormat = "jpg" | "png";

export function canvasToBlob(
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

export async function encodePhoto(
  canvas: HTMLCanvasElement,
  format: IdPhotoFormat,
  quality: number,
): Promise<Uint8Array> {
  const blob = await canvasToBlob(
    canvas,
    format === "png" ? "image/png" : "image/jpeg",
    format === "png" ? undefined : quality,
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return format === "png"
    ? insertPngDpi(bytes, ID_PHOTO_DPI)
    : setJpegDpi(bytes, ID_PHOTO_DPI);
}

/**
 * Writes 300 DPI into a JPEG's JFIF header so Windows prints the photo at the
 * intended millimetre size. Canvas JPEGs otherwise default to 96 DPI.
 */
export function setJpegDpi(input: Uint8Array, dpi: number): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    return input;
  }

  let offset = 2;
  while (offset + 4 <= input.length) {
    if (input[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = input[offset + 1];
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) break;

    const length = (input[offset + 2] << 8) | input[offset + 3];
    if (length < 2) break;

    if (
      marker === 0xe0 &&
      length >= 16 &&
      input[offset + 4] === 0x4a &&
      input[offset + 5] === 0x46 &&
      input[offset + 6] === 0x49 &&
      input[offset + 7] === 0x46 &&
      input[offset + 8] === 0x00
    ) {
      const output = input.slice();
      output[offset + 11] = 1;
      output[offset + 12] = (dpi >> 8) & 0xff;
      output[offset + 13] = dpi & 0xff;
      output[offset + 14] = (dpi >> 8) & 0xff;
      output[offset + 15] = dpi & 0xff;
      return output;
    }

    offset += 2 + length;
  }

  const segment = new Uint8Array([
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x01,
    (dpi >> 8) & 0xff,
    dpi & 0xff,
    (dpi >> 8) & 0xff,
    dpi & 0xff,
    0x00,
    0x00,
  ]);
  const output = new Uint8Array(input.length + segment.length);
  output.set(input.subarray(0, 2), 0);
  output.set(segment, 2);
  output.set(input.subarray(2), 2 + segment.length);
  return output;
}