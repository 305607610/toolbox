const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const METERS_PER_INCH = 0.0254;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function assertPng(bytes: Uint8Array) {
  if (bytes.length < 8) throw new Error("PNG 数据不完整");
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      throw new Error("不是有效的 PNG 文件");
    }
  }
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  for (let index = 0; index < 4; index += 1) {
    chunk[4 + index] = type.charCodeAt(index);
  }
  chunk.set(data, 8);

  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(chunk.subarray(4, 8), 0);
  crcInput.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcInput));
  return chunk;
}

export function insertPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  assertPng(png);

  const pixelsPerMeter = Math.round(dpi / METERS_PER_INCH);
  const physData = new Uint8Array(9);
  const physView = new DataView(physData.buffer);
  physView.setUint32(0, pixelsPerMeter);
  physView.setUint32(4, pixelsPerMeter);
  physView.setUint8(8, 1);
  const physChunk = makeChunk("pHYs", physData);

  const chunks: Uint8Array[] = [];
  let offset = 8;
  let sawHeader = false;

  while (offset < png.length) {
    if (offset + 12 > png.length) throw new Error("PNG 区块不完整");
    const length = new DataView(
      png.buffer,
      png.byteOffset + offset,
      4,
    ).getUint32(0);
    const end = offset + 12 + length;
    if (end > png.length) throw new Error("PNG 区块超出文件长度");
    const type = String.fromCharCode(
      png[offset + 4],
      png[offset + 5],
      png[offset + 6],
      png[offset + 7],
    );

    if (type !== "pHYs") {
      chunks.push(png.slice(offset, end));
      if (type === "IHDR") {
        chunks.push(physChunk);
        sawHeader = true;
      }
    }
    offset = end;
  }

  if (!sawHeader) throw new Error("PNG 缺少 IHDR");

  const total = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  output.set(PNG_SIGNATURE, 0);
  let cursor = 8;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

export interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  dpiX?: number;
  dpiY?: number;
}

export function readPngInfo(png: Uint8Array): PngInfo {
  assertPng(png);
  let offset = 8;
  let info: PngInfo | null = null;

  while (offset + 12 <= png.length) {
    const length = new DataView(
      png.buffer,
      png.byteOffset + offset,
      4,
    ).getUint32(0);
    const type = String.fromCharCode(
      png[offset + 4],
      png[offset + 5],
      png[offset + 6],
      png[offset + 7],
    );
    const dataStart = offset + 8;

    if (type === "IHDR" && length >= 13) {
      const view = new DataView(png.buffer, png.byteOffset + dataStart, 13);
      info = {
        width: view.getUint32(0),
        height: view.getUint32(4),
        bitDepth: view.getUint8(8),
        colorType: view.getUint8(9),
      };
    }

    if (type === "pHYs" && length >= 9 && info) {
      const view = new DataView(png.buffer, png.byteOffset + dataStart, 9);
      if (view.getUint8(8) === 1) {
        info.dpiX = Math.round(view.getUint32(0) * METERS_PER_INCH);
        info.dpiY = Math.round(view.getUint32(4) * METERS_PER_INCH);
      }
    }

    offset += 12 + length;
  }

  if (!info) throw new Error("PNG 缺少 IHDR");
  return info;
}