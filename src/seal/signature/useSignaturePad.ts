import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { clamp, mmToPx } from "../geometry";
import { canvasToPng } from "../export";
import type { Background } from "../export";
import { decodeImage } from "../../image/io";

export interface SignaturePoint {
  x: number;
  y: number;
}

export type SignatureSource = "draw" | "image";
export type SignatureInkMode = "original" | "solid";

export interface SignatureImageInfo {
  name: string;
}

interface ProcessedSignature {
  canvas: HTMLCanvasElement;
  hasInk: boolean;
}

const MAX_IMAGE_EDGE = 3000;
const ANALYSIS_EDGE = 256;

interface ImageAnalysis {
  /** Local paper luminance, upscaled to the processing canvas. */
  background: Uint8Array | null;
  /** The upload already has an alpha channel we can use as the mask. */
  hasAlpha: boolean;
}

function analyzeImage(source: HTMLCanvasElement): ImageAnalysis {
  const width = source.width;
  const height = source.height;
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) return { background: null, hasAlpha: false };
  const data = context.getImageData(0, 0, width, height).data;

  let translucent = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 240) translucent += 1;
  }
  if (translucent > (data.length / 4) * 0.01) {
    return { background: null, hasAlpha: true };
  }

  const scale = Math.min(1, ANALYSIS_EDGE / Math.max(width, height));
  const smallWidth = Math.max(1, Math.round(width * scale));
  const smallHeight = Math.max(1, Math.round(height * scale));
  const small = document.createElement("canvas");
  small.width = smallWidth;
  small.height = smallHeight;
  const smallContext = small.getContext("2d", { willReadFrequently: true });
  if (!smallContext) return { background: null, hasAlpha: false };
  smallContext.imageSmoothingEnabled = true;
  smallContext.imageSmoothingQuality = "high";
  smallContext.drawImage(source, 0, 0, smallWidth, smallHeight);
  const smallData = smallContext.getImageData(
    0,
    0,
    smallWidth,
    smallHeight,
  ).data;

  const luminance = new Float32Array(smallWidth * smallHeight);
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    luminance[index] =
      smallData[offset] * 0.299 +
      smallData[offset + 1] * 0.587 +
      smallData[offset + 2] * 0.114;
  }

  // A local maximum larger than any stroke estimates the paper under the ink.
  const radius = Math.max(
    2,
    Math.round(Math.min(smallWidth, smallHeight) * 0.12),
  );
  const horizontal = new Float32Array(smallWidth * smallHeight);
  for (let y = 0; y < smallHeight; y += 1) {
    const row = y * smallWidth;
    for (let x = 0; x < smallWidth; x += 1) {
      let max = 0;
      const start = Math.max(0, x - radius);
      const end = Math.min(smallWidth - 1, x + radius);
      for (let cursor = start; cursor <= end; cursor += 1) {
        max = Math.max(max, luminance[row + cursor]);
      }
      horizontal[row + x] = max;
    }
  }

  const expanded = new Float32Array(smallWidth * smallHeight);
  for (let x = 0; x < smallWidth; x += 1) {
    for (let y = 0; y < smallHeight; y += 1) {
      let max = 0;
      const start = Math.max(0, y - radius);
      const end = Math.min(smallHeight - 1, y + radius);
      for (let cursor = start; cursor <= end; cursor += 1) {
        max = Math.max(max, horizontal[cursor * smallWidth + x]);
      }
      expanded[y * smallWidth + x] = max;
    }
  }

  const background = new Uint8Array(width * height);
  const scaleX = smallWidth / width;
  const scaleY = smallHeight / height;
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      smallHeight - 1,
      Math.max(0, (y + 0.5) * scaleY - 0.5),
    );
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(smallHeight - 1, y0 + 1);
    const ty = sourceY - y0;
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(
        smallWidth - 1,
        Math.max(0, (x + 0.5) * scaleX - 0.5),
      );
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(smallWidth - 1, x0 + 1);
      const tx = sourceX - x0;
      const top =
        expanded[y0 * smallWidth + x0] * (1 - tx) +
        expanded[y0 * smallWidth + x1] * tx;
      const bottom =
        expanded[y1 * smallWidth + x0] * (1 - tx) +
        expanded[y1 * smallWidth + x1] * tx;
      background[y * width + x] = Math.round(
        top * (1 - ty) + bottom * ty,
      );
    }
  }

  return { background, hasAlpha: false };
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const expanded =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const int = Number.parseInt(expanded, 16);
  if (!Number.isFinite(int)) return [28, 29, 32];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

interface Stroke {
  points: SignaturePoint[];
  widthMm: number;
  color: string;
}

interface SignatureState {
  present: Stroke[];
  past: Stroke[][];
  future: Stroke[][];
}

type SignatureAction =
  | { type: "add"; stroke: Stroke }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear" };

const initialState: SignatureState = {
  present: [],
  past: [],
  future: [],
};

const MAX_HISTORY = 50;

function reducer(
  state: SignatureState,
  action: SignatureAction,
): SignatureState {
  switch (action.type) {
    case "add":
      return {
        present: [...state.present, action.stroke],
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        future: [],
      };
    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future].slice(0, MAX_HISTORY),
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        present: next,
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        future: state.future.slice(1),
      };
    }
    case "clear":
      if (state.present.length === 0) return state;
      return {
        present: [],
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        future: [],
      };
    default:
      return state;
  }
}

function smoothPoints(
  points: SignaturePoint[],
  smoothing: number,
): SignaturePoint[] {
  if (smoothing <= 1 || points.length < 3) return points;
  const radius = Math.max(1, Math.round((smoothing / 100) * 5));
  return points.map((point, index) => {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    const start = Math.max(0, index - radius);
    const end = Math.min(points.length - 1, index + radius);
    for (let cursor = start; cursor <= end; cursor += 1) {
      sumX += points[cursor].x;
      sumY += points[cursor].y;
      count += 1;
    }
    return {
      x: sumX / count + (point.x - sumX / count) * 0.15,
      y: sumY / count + (point.y - sumY / count) * 0.15,
    };
  });
}

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  smoothing = 0,
): void {
  const points = smoothPoints(stroke.points, smoothing);
  if (points.length === 0) return;

  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.widthMm;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (points.length === 1) {
    context.beginPath();
    context.arc(
      points[0].x,
      points[0].y,
      stroke.widthMm / 2,
      0,
      Math.PI * 2,
    );
    context.fill();
    return;
  }

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[index - 1];
    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;
    context.quadraticCurveTo(previous.x, previous.y, midX, midY);
  }
  const last = points[points.length - 1];
  context.lineTo(last.x, last.y);
  context.stroke();
}

function strokeBounds(stroke: Stroke, smoothing = 0) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of smoothPoints(stroke.points, smoothing)) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const inset = stroke.widthMm / 2;
  return {
    minX: minX - inset,
    minY: minY - inset,
    maxX: maxX + inset,
    maxY: maxY + inset,
  };
}

export function useSignaturePad() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [penWidth, setPenWidth] = useState(3);
  const [color, setColor] = useState("#1C1D20");
  const [smoothing, setSmoothing] = useState(40);
  const [cropPadding, setCropPadding] = useState(3);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [activePointer, setActivePointer] = useState<number | null>(null);
  const [current, setCurrent] = useState<Stroke | null>(null);

  const [source, setSourceState] = useState<SignatureSource>("draw");
  const [imageInfo, setImageInfo] = useState<SignatureImageInfo | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageHasInk, setImageHasInk] = useState(false);
  const [imageHasAlpha, setImageHasAlpha] = useState(false);
  const [threshold, setThreshold] = useState(15);
  const [softness, setSoftness] = useState(15);
  const [inkMode, setInkMode] = useState<SignatureInkMode>("original");
  const [previewCanvas, setPreviewCanvas] =
    useState<HTMLCanvasElement | null>(null);

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processedRef = useRef<ProcessedSignature | null>(null);
  const analysisRef = useRef<ImageAnalysis | null>(null);
  const loadTokenRef = useRef(0);

  const setSource = useCallback((next: SignatureSource) => {
    if (next !== "image") {
      loadTokenRef.current += 1;
      setImageLoading(false);
    }
    setSourceState(next);
    if (next === "draw") {
      setActivePointer(null);
      setCurrent(null);
    }
  }, []);

  const computeProcessed = useCallback((): ProcessedSignature | null => {
    const sourceCanvas = sourceCanvasRef.current;
    if (!sourceCanvas) return null;
    const context = sourceCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!context) return null;

    const image = context.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
    );
    const { data } = image;
    const analysis = analysisRef.current;
    const [solidR, solidG, solidB] = hexToRgb(color);
    const solid = inkMode === "solid";
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const lower = threshold / 100;
    const band = Math.max(0.02, softness / 100);

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const sourceAlpha = data[index + 3];
        const background = analysis?.background
          ? Math.max(1, analysis.background[y * width + x])
          : 230;
        let alpha: number;

        if (analysis?.hasAlpha) {
          alpha = sourceAlpha;
        } else {
          const luminance =
            data[index] * 0.299 +
            data[index + 1] * 0.587 +
            data[index + 2] * 0.114;
          const darkness = 1 - luminance / background;
          const ratio = (darkness - lower) / band;
          alpha = Math.round(
            Math.min(1, Math.max(0, ratio)) * sourceAlpha,
          );
        }

        data[index + 3] = alpha;

        if (alpha === 0) {
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
        } else if (solid) {
          data[index] = solidR;
          data[index + 1] = solidG;
          data[index + 2] = solidB;
        } else if (!analysis?.hasAlpha && alpha < 255) {
          const opaque = alpha / 255;
          const inverse = 1 - opaque;
          data[index] = clamp(
            Math.round((data[index] - inverse * background) / opaque),
            0,
            255,
          );
          data[index + 1] = clamp(
            Math.round(
              (data[index + 1] - inverse * background) / opaque,
            ),
            0,
            255,
          );
          data[index + 2] = clamp(
            Math.round(
              (data[index + 2] - inverse * background) / opaque,
            ),
            0,
            255,
          );
        }

        if (alpha > 10) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return { canvas: document.createElement("canvas"), hasInk: false };
    }

    const cropped = document.createElement("canvas");
    cropped.width = maxX - minX + 1;
    cropped.height = maxY - minY + 1;
    const croppedContext = cropped.getContext("2d");
    if (!croppedContext) return null;
    croppedContext.putImageData(image, -minX, -minY);

    return { canvas: cropped, hasInk: true };
  }, [threshold, softness, inkMode, color]);

  const drawImagePreview = useCallback(() => {
    if (!previewCanvas) return;
    const cssWidth = previewCanvas.clientWidth || 560;
    const cssHeight = previewCanvas.clientHeight || 280;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));

    if (previewCanvas.width !== width) previewCanvas.width = width;
    if (previewCanvas.height !== height) previewCanvas.height = height;

    const context = previewCanvas.getContext("2d");
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);

    const processed = processedRef.current;
    if (!processed?.hasInk) return;

    const image = processed.canvas;
    const scale = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
  }, [previewCanvas]);

  useEffect(() => {
    if (source !== "image" || !imageInfo) {
      processedRef.current = null;
      setImageHasInk(false);
      drawImagePreview();
      return;
    }

    const timer = window.setTimeout(() => {
      const processed = computeProcessed();
      processedRef.current = processed;
      setImageHasInk(processed?.hasInk ?? false);
      drawImagePreview();
    }, 60);

    return () => window.clearTimeout(timer);
  }, [source, imageInfo, computeProcessed, drawImagePreview]);

  useEffect(() => {
    if (!previewCanvas) return;
    drawImagePreview();
    const observer = new ResizeObserver(() => drawImagePreview());
    observer.observe(previewCanvas);
    return () => observer.disconnect();
  }, [previewCanvas, drawImagePreview]);

  const loadImage = useCallback(async (file: File) => {
    const token = loadTokenRef.current + 1;
    loadTokenRef.current = token;
    setImageLoading(true);
    setImageError(null);

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await decodeImage(file);
      if (token !== loadTokenRef.current) return;

      const scale = Math.min(
        1,
        MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height),
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = width;
      sourceCanvas.height = height;
      const context = sourceCanvas.getContext("2d", {
        willReadFrequently: true,
      });
      if (!context) throw new Error("无法创建画布");

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);

      sourceCanvasRef.current = sourceCanvas;
      const analysis = analyzeImage(sourceCanvas);
      analysisRef.current = analysis;
      setImageHasAlpha(analysis.hasAlpha);
      const processed = computeProcessed();
      processedRef.current = processed;
      setImageHasInk(processed?.hasInk ?? false);
      setImageInfo({ name: file.name });
      setSourceState("image");
    } catch {
      if (token === loadTokenRef.current) {
        setImageError("无法读取图片");
      }
    } finally {
      bitmap?.close();
      if (token === loadTokenRef.current) setImageLoading(false);
    }
  }, [computeProcessed]);

  const removeImage = useCallback(() => {
    loadTokenRef.current += 1;
    sourceCanvasRef.current = null;
    processedRef.current = null;
    analysisRef.current = null;
    setImageHasAlpha(false);
    setImageInfo(null);
    setImageError(null);
    setImageLoading(false);
    setImageHasInk(false);
    setSourceState("draw");
  }, []);

  const draw = useCallback(() => {
    if (!canvas) return;
    const cssWidth = canvas.clientWidth || 560;
    const cssHeight = canvas.clientHeight || 280;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.scale(width / 60, height / 30);

    context.save();
    context.strokeStyle = "#D6D6D0";
    context.lineWidth = 0.2;
    context.setLineDash([1.2, 1.2]);
    context.beginPath();
    context.moveTo(10, 22);
    context.lineTo(50, 22);
    context.stroke();
    context.restore();

    for (const stroke of state.present) {
      drawStroke(context, stroke, smoothing);
    }
    if (current) drawStroke(context, current, smoothing);
  }, [canvas, state.present, current, smoothing]);

  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (!canvas) {
      setActivePointer(null);
      setCurrent(null);
      return;
    }
    const observer = new ResizeObserver(() => drawRef.current());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvas]);

  const pointFromEvent = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): SignaturePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 60, 0, 60),
      y: clamp(((event.clientY - rect.top) / rect.height) * 30, 0, 30),
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointer !== null) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setActivePointer(event.pointerId);
    setCurrent({
      points: [pointFromEvent(event)],
      widthMm: (penWidth * 60) / 560,
      color,
    });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointer !== event.pointerId || !current) return;
    const point = pointFromEvent(event);
    const previous = current.points[current.points.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.08) {
      return;
    }
    setCurrent({
      ...current,
      points: [...current.points, point],
    });
  };

  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointer !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (current) {
      dispatch({ type: "add", stroke: current });
    }
    setCurrent(null);
    setActivePointer(null);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    finishStroke(event);
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointer !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setCurrent(null);
    setActivePointer(null);
  };

  const exportImagePng = async (
    widthMm: number,
    background: Background,
  ): Promise<Uint8Array> => {
    const processed = computeProcessed();
    if (!processed?.hasInk) {
      throw new Error("未检测到笔迹，请调低去底阈值");
    }

    const dpi = 600;
    const targetWidth = clamp(widthMm, 10, 200);
    const totalWidthPx = Math.max(1, Math.round(mmToPx(targetWidth, dpi)));
    const padPx = Math.max(0, Math.round(mmToPx(cropPadding, dpi)));
    const contentWidthPx = Math.max(1, totalWidthPx - padPx * 2);
    const contentHeightPx = Math.max(
      1,
      Math.round(
        contentWidthPx * (processed.canvas.height / processed.canvas.width),
      ),
    );
    const pixelWidth = contentWidthPx + padPx * 2;
    const pixelHeight = contentHeightPx + padPx * 2;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = pixelWidth;
    exportCanvas.height = pixelHeight;
    const context = exportCanvas.getContext("2d");
    if (!context) throw new Error("无法创建画布");

    if (background === "white") {
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, pixelWidth, pixelHeight);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      processed.canvas,
      padPx,
      padPx,
      contentWidthPx,
      contentHeightPx,
    );

    return canvasToPng(exportCanvas, dpi);
  };

  const exportPng = async (
    widthMm: number,
    background: Background = "transparent",
  ): Promise<Uint8Array> => {
    if (source === "image") {
      return exportImagePng(widthMm, background);
    }
    if (state.present.length === 0) {
      throw new Error("请先手写签名");
    }

    const padMm = cropPadding;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const stroke of state.present) {
      const bounds = strokeBounds(stroke, smoothing);
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    }

    minX = Math.max(0, minX - padMm);
    minY = Math.max(0, minY - padMm);
    maxX = Math.min(60, maxX + padMm);
    maxY = Math.min(30, maxY + padMm);

    const cropWidth = Math.max(1, maxX - minX);
    const cropHeight = Math.max(1, maxY - minY);
    const targetWidth = clamp(widthMm, 10, 200);
    const targetHeight = targetWidth * (cropHeight / cropWidth);
    const dpi = 600;
    const pixelWidth = Math.max(1, Math.round(mmToPx(targetWidth, dpi)));
    const pixelHeight = Math.max(1, Math.round(mmToPx(targetHeight, dpi)));

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = pixelWidth;
    exportCanvas.height = pixelHeight;
    const context = exportCanvas.getContext("2d");
    if (!context) throw new Error("无法创建画布");

    if (background === "white") {
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, pixelWidth, pixelHeight);
    }
    context.setTransform(
      pixelWidth / cropWidth,
      0,
      0,
      pixelHeight / cropHeight,
      0,
      0,
    );
    context.translate(-minX, -minY);
    for (const stroke of state.present) {
      drawStroke(context, stroke, smoothing);
    }

    return canvasToPng(exportCanvas, dpi);
  };

  return {
    setCanvas,
    draw,
    strokes: state.present,
    hasInk: source === "draw" ? state.present.length > 0 : imageHasInk,
    drawing: activePointer !== null,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    clear: () => dispatch({ type: "clear" }),
    source,
    setSource,
    imageInfo,
    imageLoading,
    imageError,
    imageHasAlpha,
    loadImage,
    removeImage,
    threshold,
    setThreshold,
    softness,
    setSoftness,
    inkMode,
    setInkMode,
    setPreviewCanvas,
    penWidth,
    setPenWidth,
    color,
    setColor,
    smoothing,
    setSmoothing,
    cropPadding,
    setCropPadding,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    exportPng,
  };
}

export type SignaturePad = ReturnType<typeof useSignaturePad>;