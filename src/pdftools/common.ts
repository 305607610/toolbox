export type PdfToolMode =
  | "merge"
  | "extract"
  | "delete"
  | "rotate"
  | "images"
  | "watermark"
  | "stamp"
  | "decrypt";

export interface PdfInfo {
  path: string;
  pages: number;
  encrypted: boolean;
  size: number;
}

export interface PdfFile extends PdfInfo {
  name: string;
}

export interface ImageFile {
  path: string;
  name: string;
}

export const PDF_TOOL_MODES: { value: PdfToolMode; label: string }[] = [
  { value: "merge", label: "合并" },
  { value: "extract", label: "提取页面" },
  { value: "delete", label: "删除页面" },
  { value: "rotate", label: "旋转页面" },
  { value: "images", label: "图片转 PDF" },
  { value: "watermark", label: "文字水印" },
  { value: "stamp", label: "图片盖章" },
  { value: "decrypt", label: "移除密码" },
];

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

export const POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "top-left", label: "左上" },
  { value: "top-center", label: "上中" },
  { value: "top-right", label: "右上" },
  { value: "middle-left", label: "左中" },
  { value: "center", label: "居中" },
  { value: "middle-right", label: "右中" },
  { value: "bottom-left", label: "左下" },
  { value: "bottom-center", label: "下中" },
  { value: "bottom-right", label: "右下" },
];

export const MODE_LABEL = (mode: PdfToolMode) =>
  PDF_TOOL_MODES.find((item) => item.value === mode)?.label ?? "PDF";

export function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function stemOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function parsePageRange(
  value: string,
  total: number,
): { pages: number[]; error: string } {
  if (total <= 0) {
    return { pages: [], error: "PDF 没有可用的页面" };
  }
  const raw = value.trim();
  if (!raw) {
    return { pages: [], error: "请输入页码范围，如 1-3,5" };
  }

  const pages = new Set<number>();
  for (const token of raw.replace(/[，、]/g, ",").split(",")) {
    const part = token.trim();
    if (!part) continue;
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) {
      return { pages: [], error: `无法识别「${part}」` };
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < 1 || start > total || end > total) {
      return { pages: [], error: `页码需在 1–${total} 之间` };
    }
    if (start > end) {
      return { pages: [], error: `「${part}」的起止顺序不对` };
    }
    for (let page = start; page <= end; page += 1) {
      pages.add(page);
    }
  }

  if (pages.size === 0) {
    return { pages: [], error: "请输入页码范围" };
  }
  return { pages: [...pages].sort((a, b) => a - b), error: "" };
}

export function pagesToSpec(pages: number[]): string {
  const parts: string[] = [];
  let index = 0;
  while (index < pages.length) {
    const start = pages[index];
    let end = start;
    while (index + 1 < pages.length && pages[index + 1] === end + 1) {
      index += 1;
      end = pages[index];
    }
    parts.push(start === end ? String(start) : `${start}-${end}`);
    index += 1;
  }
  return parts.join(",");
}

export function suggestedOutputName(
  mode: PdfToolMode,
  pdfName?: string,
): string {
  const stem = pdfName ? stemOf(pdfName) : "PDF";
  switch (mode) {
    case "merge":
      return "合并.pdf";
    case "extract":
      return `${stem}_提取.pdf`;
    case "delete":
      return `${stem}_删除页面.pdf`;
    case "rotate":
      return `${stem}_旋转.pdf`;
    case "images":
      return "图片合集.pdf";
    case "watermark":
      return `${stem}_水印.pdf`;
    case "stamp":
      return `${stem}_盖章.pdf`;
    case "decrypt":
      return `${stem}_无密码.pdf`;
  }
}