import { mmToPx } from "./geometry";
import { insertPngDpi } from "./png";

export type Background = "transparent" | "white";

export interface SealExportOptions {
  widthMm: number;
  heightMm: number;
  dpi: number;
  background: Background;
}

function cloneSvg(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("class");
  clone.querySelectorAll("*").forEach((element) => {
    element.removeAttribute("class");
  });
  return clone;
}

function addWhiteBackground(clone: SVGSVGElement): void {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("fill", "#FFFFFF");
  clone.insertBefore(rect, clone.firstChild);
}

function serialize(clone: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(clone);
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("SVG 渲染失败"));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG 生成失败"));
    }, "image/png");
  });
}

export async function svgToPng(
  svg: SVGSVGElement,
  options: SealExportOptions,
): Promise<Uint8Array> {
  await document.fonts.ready;

  const widthPx = Math.max(1, Math.round(mmToPx(options.widthMm, options.dpi)));
  const heightPx = Math.max(1, Math.round(mmToPx(options.heightMm, options.dpi)));
  const clone = cloneSvg(svg);
  clone.setAttribute("width", String(widthPx));
  clone.setAttribute("height", String(heightPx));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute(
      "viewBox",
      `0 0 ${options.widthMm} ${options.heightMm}`,
    );
  }
  if (options.background === "white") addWhiteBackground(clone);

  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialize(clone))}`;
  const image = await loadImage(source);

  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建画布");

  if (options.background === "white") {
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, widthPx, heightPx);
  }
  context.drawImage(image, 0, 0, widthPx, heightPx);

  const blob = await canvasToBlob(canvas);
  const png = new Uint8Array(await blob.arrayBuffer());
  return insertPngDpi(png, options.dpi);
}

export function svgToFile(
  svg: SVGSVGElement,
  options: Omit<SealExportOptions, "dpi">,
): string {
  const clone = cloneSvg(svg);
  clone.setAttribute("width", `${options.widthMm}mm`);
  clone.setAttribute("height", `${options.heightMm}mm`);
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute(
      "viewBox",
      `0 0 ${options.widthMm} ${options.heightMm}`,
    );
  }
  if (options.background === "white") addWhiteBackground(clone);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialize(clone)}`;
}

export async function canvasToPng(
  canvas: HTMLCanvasElement,
  dpi: number,
): Promise<Uint8Array> {
  const blob = await canvasToBlob(canvas);
  const png = new Uint8Array(await blob.arrayBuffer());
  return insertPngDpi(png, dpi);
}