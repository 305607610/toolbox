import { useCallback, useEffect, useRef } from "react";
import { drawPersonalSeal } from "./drawPersonalSeal";
import type { PersonalConfig } from "../types";

interface PersonalSealCanvasProps {
  config: PersonalConfig;
  text: string;
  ready: boolean;
}

export default function PersonalSealCanvas({
  config,
  text,
  ready,
}: PersonalSealCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!ready) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const cssWidth = canvas.clientWidth || 300;
    const dpr = window.devicePixelRatio || 1;
    const pxPerMm = (cssWidth * dpr) / config.size;
    drawPersonalSeal(canvas, { config, text, pxPerMm });
  }, [config, text, ready]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="personal-canvas"
      role="img"
      aria-label={`个人章预览：${text || "未填写姓名"}`}
    />
  );
}