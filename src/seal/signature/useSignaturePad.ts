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

export interface SignaturePoint {
  x: number;
  y: number;
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

  const exportPng = async (
    widthMm: number,
    background: Background = "transparent",
  ): Promise<Uint8Array> => {
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
    hasInk: state.present.length > 0,
    drawing: activePointer !== null,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    clear: () => dispatch({ type: "clear" }),
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