import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  App as AntdApp,
  Button,
  Segmented,
  Select,
  Slider,
  Spin,
  Switch,
} from "antd";
import {
  ArrowLeft,
  Download,
  IdCard,
  ImagePlus,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { formatBytes } from "../compress/compress";
import { sanitizeFilename } from "../seal/filename";
import { saveExport } from "../seal/save";
import {
  BACKGROUND_PRESETS,
  DEFAULT_SPEC_ID,
  ID_PHOTO_DPI,
  ID_PHOTO_SPECS,
  backgroundById,
  sheetLayout,
  specById,
  specPixels,
  type BackgroundId,
} from "../idphoto/specs";
import {
  clamp,
  drawGuides,
  offsetBounds,
  prepareForeground,
  renderPhoto,
  renderSheet,
} from "../idphoto/process";
import {
  canvasToBlob,
  encodePhoto,
  type IdPhotoFormat,
} from "../idphoto/export";
import "../styles/idphoto.css";

type StageMode = "single" | "sheet";

interface SourcePhoto {
  name: string;
  size: number;
  width: number;
  height: number;
}

interface PanState {
  pointerId: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
  displayWidth: number;
  displayHeight: number;
}

const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function IdPhotoTool() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = AntdApp.useApp();

  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const panRef = useRef<PanState | null>(null);
  const dragDepth = useRef(0);

  const [source, setSource] = useState<SourcePhoto | null>(null);
  const [specId, setSpecId] = useState(DEFAULT_SPEC_ID);
  const [background, setBackground] = useState<BackgroundId>("white");
  const [zoom, setZoom] = useState(100);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [tolerance, setTolerance] = useState(35);
  const [feather, setFeather] = useState(2);
  const [guides, setGuides] = useState(true);
  const [stageMode, setStageMode] = useState<StageMode>("single");
  const [format, setFormat] = useState<IdPhotoFormat>("jpg");
  const [quality, setQuality] = useState(92);
  const [foreground, setForeground] = useState<HTMLCanvasElement | null>(null);
  const [fallback, setFallback] = useState(false);
  const [masking, setMasking] = useState(false);
  const [approxBytes, setApproxBytes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [moving, setMoving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const spec = useMemo(() => specById(specId), [specId]);
  const pixels = useMemo(() => specPixels(spec), [spec]);
  const sheet = useMemo(() => sheetLayout(spec), [spec]);
  const backgroundPreset = backgroundById(background);
  const removeBackground = backgroundPreset.color !== null;

  const bounds = useMemo(() => {
    if (!source) return { x: 0, y: 0 };
    return offsetBounds(
      { width: source.width, height: source.height },
      spec,
      zoom / 100,
    );
  }, [source, spec, zoom]);

  useEffect(() => {
    setOffsetX((value) => clamp(value, -bounds.x, bounds.x));
    setOffsetY((value) => clamp(value, -bounds.y, bounds.y));
  }, [bounds.x, bounds.y]);

  const effectiveX = clamp(offsetX, -bounds.x, bounds.x);
  const effectiveY = clamp(offsetY, -bounds.y, bounds.y);
  const maxXPercent = Math.round(bounds.x * 100);
  const maxYPercent = Math.round(bounds.y * 100);

  const from = (location.state as { from?: string } | null)?.from;
  const goBack = useCallback(() => {
    if (from && from.startsWith("/")) navigate(from);
    else navigate("/");
  }, [from, navigate]);

  const buildPhoto = useCallback(() => {
    if (!source) return null;
    const bitmap = bitmapRef.current;
    if (!bitmap) return null;
    const image = removeBackground && foreground ? foreground : bitmap;
    return renderPhoto(image, spec, backgroundPreset.color, {
      zoom: zoom / 100,
      offsetX: effectiveX,
      offsetY: effectiveY,
    });
  }, [
    source,
    removeBackground,
    foreground,
    spec,
    backgroundPreset.color,
    zoom,
    effectiveX,
    effectiveY,
  ]);

  const loadPhoto = useCallback(
    async (file: File) => {
      if (!SUPPORTED_TYPES.includes(file.type)) {
        message.error("支持 JPG、PNG、WebP");
        return;
      }
      setLoading(true);
      try {
        const bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
        if (!bitmap.width || !bitmap.height) {
          bitmap.close();
          throw new Error("empty");
        }
        const previous = bitmapRef.current;
        bitmapRef.current = bitmap;
        setForeground(null);
        setFallback(false);
        setSource({
          name: file.name,
          size: file.size,
          width: bitmap.width,
          height: bitmap.height,
        });
        setZoom(100);
        setOffsetX(0);
        setOffsetY(0);
        setStageMode("single");
        if (previous) window.setTimeout(() => previous.close(), 0);
      } catch {
        message.error("无法读取这张照片");
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  const acceptFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      const supported = list.filter((file) =>
        SUPPORTED_TYPES.includes(file.type),
      );
      if (supported.length === 0) {
        message.error("支持 JPG、PNG、WebP");
        return;
      }
      if (supported.length > 1) {
        message.warning("一次制作一张照片，已使用第一张");
      }
      void loadPhoto(supported[0]);
    },
    [loadPhoto, message],
  );

  const openPicker = () => inputRef.current?.click();

  useEffect(() => {
    if (!source) {
      setForeground(null);
      setFallback(false);
      setMasking(false);
      return;
    }
    if (!removeBackground) {
      setForeground(null);
      setFallback(false);
      setMasking(false);
      return;
    }
    const bitmap = bitmapRef.current;
    if (!bitmap) {
      setMasking(false);
      return;
    }

    let cancelled = false;
    setMasking(true);
    const timer = window.setTimeout(() => {
      try {
        const result = prepareForeground(bitmap, tolerance, feather);
        if (cancelled) return;
        setForeground(result.canvas);
        setFallback(result.fallback);
      } catch {
        if (cancelled) return;
        setForeground(null);
        setFallback(true);
      } finally {
        if (!cancelled) setMasking(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [source, removeBackground, tolerance, feather]);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const photo = buildPhoto();
    if (!photo) return;

    if (stageMode === "sheet") {
      const rendered = renderSheet(photo, spec);
      canvas.width = rendered.canvas.width;
      canvas.height = rendered.canvas.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(rendered.canvas, 0, 0);
      return;
    }

    canvas.width = photo.width;
    canvas.height = photo.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(photo, 0, 0);
    if (guides) drawGuides(context, photo.width, photo.height);
    context.strokeStyle = "rgba(20, 22, 26, 0.14)";
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, photo.width - 1, photo.height - 1);
  }, [buildPhoto, stageMode, guides, spec]);

  useEffect(() => {
    if (stageMode !== "single" || !source) {
      setApproxBytes(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const photo = buildPhoto();
      if (!photo) return;
      try {
        const blob = await canvasToBlob(
          photo,
          format === "png" ? "image/png" : "image/jpeg",
          format === "png" ? undefined : quality / 100,
        );
        if (!cancelled) setApproxBytes(blob.size);
      } catch {
        if (!cancelled) setApproxBytes(null);
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [buildPhoto, stageMode, source, format, quality]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, [contenteditable='true'], .ant-select, .ant-popover, .ant-modal",
        )
      ) {
        return;
      }
      if (
        document.querySelector(
          ".ant-popover:not(.ant-popover-hidden), .ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-modal-wrap",
        )
      ) {
        return;
      }
      goBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (stageMode !== "single") return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(
      rect.width / canvas.width,
      rect.height / canvas.height,
    );
    if (!scale || !Number.isFinite(scale)) return;
    const displayWidth = canvas.width * scale;
    const displayHeight = canvas.height * scale;
    const left = rect.left + (rect.width - displayWidth) / 2;
    const top = rect.top + (rect.height - displayHeight) / 2;
    if (
      event.clientX < left ||
      event.clientX > left + displayWidth ||
      event.clientY < top ||
      event.clientY > top + displayHeight
    ) {
      return;
    }
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: effectiveX,
      startOffsetY: effectiveY,
      displayWidth,
      displayHeight,
    };
    canvas.setPointerCapture(event.pointerId);
    setMoving(true);
    event.preventDefault();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const dx = (event.clientX - pan.startX) / pan.displayWidth;
    const dy = (event.clientY - pan.startY) / pan.displayHeight;
    setOffsetX(clamp(pan.startOffsetX + dx, -bounds.x, bounds.x));
    setOffsetY(clamp(pan.startOffsetY + dy, -bounds.y, bounds.y));
  };

  const endPan = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    setMoving(false);
  };

  const carriesFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes("Files");

  const onDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(event)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (event.dataTransfer.files.length > 0) {
      acceptFiles(event.dataTransfer.files);
    }
  };

  const resetFraming = () => {
    setZoom(100);
    setOffsetX(0);
    setOffsetY(0);
  };

  const exportPhoto = async () => {
    if (!source || exporting || masking) return;
    const photo = buildPhoto();
    if (!photo) return;

    setExporting(true);
    try {
      if (stageMode === "sheet") {
        const rendered = renderSheet(photo, spec);
        const bytes = await encodePhoto(rendered.canvas, "png", 1);
        const stem = sanitizeFilename(
          `证件照_${spec.name}_6寸排版_${rendered.layout.count}张`,
          "证件照",
        );
        const result = await saveExport(bytes, stem, "png");
        if (result.status === "saved") {
          message.success(`已导出：${result.path}`);
        }
      } else {
        const bytes = await encodePhoto(photo, format, quality / 100);
        const stem = sanitizeFilename(
          `证件照_${spec.name}_${backgroundPreset.label}_${pixels.width}x${pixels.height}`,
          "证件照",
        );
        const result = await saveExport(bytes, stem, format);
        if (result.status === "saved") {
          message.success(`已导出：${result.path}`);
        }
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="tool-page idp-page"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <h1 className="visually-hidden">证件照</h1>

      <div className="idp-topbar">
        <Button
          type="text"
          className="back-btn"
          icon={<ArrowLeft size={16} strokeWidth={1.8} />}
          onClick={goBack}
        >
          返回工作台
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_TYPES.join(",")}
        tabIndex={-1}
        className="visually-hidden"
        onChange={(event) => {
          if (event.target.files) acceptFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {!source ? (
        <div className="idp-empty-wrap">
          <div className="idp-drop" onClick={openPicker}>
            <span className="idp-drop-icon" aria-hidden="true">
              <IdCard size={26} strokeWidth={1.6} />
            </span>
            <h2>拖入照片开始制作</h2>
            <p>支持 JPG、PNG、WebP，纯色背景、深色上衣的正面免冠照效果最好。</p>
            <Button
              type="primary"
              size="large"
              icon={<ImagePlus size={16} strokeWidth={1.8} />}
              loading={loading}
              onClick={(event) => {
                event.stopPropagation();
                openPicker();
              }}
            >
              选择照片
            </Button>
          </div>
        </div>
      ) : (
        <div className="idp-workspace">
          <section className="idp-stage" aria-label="证件照预览">
            <header className="idp-stage-head">
              <div className="idp-file">
                <strong title={source.name}>{source.name}</strong>
                <span>
                  {source.width} × {source.height} ·{" "}
                  {formatBytes(source.size)}
                </span>
              </div>
              <div className="idp-stage-actions">
                <Segmented
                  size="small"
                  aria-label="预览模式"
                  value={stageMode}
                  options={[
                    { label: "单张", value: "single" },
                    { label: "排版", value: "sheet" },
                  ]}
                  onChange={(value) => setStageMode(value as StageMode)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<RefreshCw size={14} strokeWidth={1.8} />}
                  onClick={openPicker}
                >
                  更换
                </Button>
              </div>
            </header>

            <div className="idp-viewer">
              <canvas
                ref={previewRef}
                className={`idp-canvas${stageMode === "sheet" ? " is-sheet" : ""}${moving ? " is-moving" : ""}`}
                aria-label={
                  stageMode === "sheet" ? "6 寸排版预览" : "证件照预览"
                }
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPan}
                onPointerCancel={endPan}
                onLostPointerCapture={endPan}
              />
              {loading && (
                <span className="idp-loading">
                  <Spin size="small" />
                  读取中
                </span>
              )}
            </div>

            <footer className="idp-stage-foot">
              <span>
                {stageMode === "sheet"
                  ? `6 寸相纸 · ${sheet.width} × ${sheet.height} px`
                  : `${spec.widthMm} × ${spec.heightMm} mm · ${pixels.width} × ${pixels.height} px`}
              </span>
              <span>
                {stageMode === "sheet"
                  ? `${sheet.count} 张 · ${ID_PHOTO_DPI} DPI`
                  : moving
                    ? "松开完成"
                    : "拖动画面调整位置"}
              </span>
            </footer>
          </section>

          <aside className="idp-panel" aria-label="证件照设置">
            <div className="idp-export">
              <div className="idp-export-head">
                <span className="idp-export-title">导出</span>
                <span className="idp-export-meta">
                  {stageMode === "single"
                    ? `${format.toUpperCase()} · ${pixels.width} × ${pixels.height}`
                    : `6 寸 · ${sheet.count} 张`}
                </span>
              </div>
              <Button
                type="primary"
                size="large"
                block
                className="idp-export-btn"
                icon={<Download size={16} strokeWidth={1.8} />}
                loading={exporting}
                disabled={masking}
                onClick={() => void exportPhoto()}
              >
                {stageMode === "single" ? "导出证件照" : "导出排版图"}
              </Button>
              <p className="idp-export-note">
                {stageMode === "single"
                  ? `${ID_PHOTO_DPI} DPI · 打印尺寸 ${spec.widthMm} × ${spec.heightMm} mm${
                      approxBytes ? ` · 约 ${formatBytes(approxBytes)}` : ""
                    }`
                  : "PNG · 300 DPI · 含裁切线"}
              </p>
            </div>

            <div className="idp-groups">
              <section className="idp-group">
                <div className="idp-group-head">
                  <h2 className="idp-group-title">规格</h2>
                </div>
                <Select
                  className="idp-select"
                  aria-label="证件照规格"
                  value={specId}
                  options={ID_PHOTO_SPECS.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  onChange={(value) => setSpecId(value)}
                />
                <p className="idp-note">
                  {spec.widthMm} × {spec.heightMm} mm · {pixels.width} ×{" "}
                  {pixels.height} px
                </p>
              </section>

              <section className="idp-group">
                <div className="idp-group-head">
                  <h2 className="idp-group-title">背景</h2>
                  {masking && (
                    <span className="idp-masking">
                      <Spin size="small" />
                      识别中
                    </span>
                  )}
                </div>
                <Segmented
                  block
                  size="small"
                  className="idp-segmented"
                  aria-label="背景颜色"
                  value={background}
                  options={BACKGROUND_PRESETS.map((preset) => ({
                    value: preset.id,
                    label: (
                      <span className="idp-bg-option">
                        <span
                          className={`idp-bg-swatch${preset.color ? "" : " idp-bg-swatch--original"}`}
                          style={
                            preset.color ? { background: preset.color } : undefined
                          }
                          aria-hidden="true"
                        />
                        {preset.label}
                      </span>
                    ),
                  }))}
                  onChange={(value) => setBackground(value as BackgroundId)}
                />

                {removeBackground && (
                  <>
                    <div className="idp-field idp-field--first">
                      <div className="idp-label-row">
                        <span className="idp-label" title="背景越复杂，容差可调高">
                          容差
                        </span>
                        <span className="idp-value">{tolerance}</span>
                      </div>
                      <Slider
                        min={0}
                        max={100}
                        aria-label="背景容差"
                        value={tolerance}
                        onChange={(value) => setTolerance(value)}
                      />
                    </div>
                    <div className="idp-field">
                      <div className="idp-label-row">
                        <span className="idp-label">羽化</span>
                        <span className="idp-value">{feather}</span>
                      </div>
                      <Slider
                        min={0}
                        max={6}
                        aria-label="边缘羽化"
                        value={feather}
                        onChange={(value) => setFeather(value)}
                      />
                    </div>
                    {fallback && (
                      <p className="idp-warn">
                        未识别到可去除的背景，已保留原图。可调整容差或选择原背景。
                      </p>
                    )}
                  </>
                )}
              </section>

              <section className="idp-group">
                <div className="idp-group-head">
                  <h2 className="idp-group-title">人像</h2>
                  <Button
                    type="text"
                    size="small"
                    className="idp-reset"
                    icon={<RotateCcw size={14} strokeWidth={1.8} />}
                    onClick={resetFraming}
                  >
                    复位
                  </Button>
                </div>

                <div className="idp-field">
                  <div className="idp-label-row">
                    <span className="idp-label">缩放</span>
                    <span className="idp-value">{zoom}%</span>
                  </div>
                  <Slider
                    min={100}
                    max={300}
                    aria-label="人像缩放"
                    value={zoom}
                    onChange={(value) => setZoom(value)}
                  />
                </div>

                <div className="idp-field">
                  <div className="idp-label-row">
                    <span className="idp-label">水平</span>
                    <span className="idp-value">
                      {Math.round(effectiveX * 100)}
                    </span>
                  </div>
                  <Slider
                    min={-maxXPercent}
                    max={Math.max(1, maxXPercent)}
                    aria-label="人像水平位置"
                    value={Math.round(effectiveX * 100)}
                    disabled={maxXPercent === 0}
                    onChange={(value) => setOffsetX(value / 100)}
                  />
                </div>

                <div className="idp-field">
                  <div className="idp-label-row">
                    <span className="idp-label">垂直</span>
                    <span className="idp-value">
                      {Math.round(effectiveY * 100)}
                    </span>
                  </div>
                  <Slider
                    min={-maxYPercent}
                    max={Math.max(1, maxYPercent)}
                    aria-label="人像垂直位置"
                    value={Math.round(effectiveY * 100)}
                    disabled={maxYPercent === 0}
                    onChange={(value) => setOffsetY(value / 100)}
                  />
                </div>

                <div className="idp-toggle-row">
                  <span className="idp-label">构图辅助线</span>
                  <Switch
                    size="small"
                    aria-label="构图辅助线"
                    checked={guides}
                    onChange={(checked) => setGuides(checked)}
                  />
                </div>
              </section>

              <section className="idp-group">
                <div className="idp-group-head">
                  <h2 className="idp-group-title">输出</h2>
                </div>
                {stageMode === "single" ? (
                  <>
                    <div className="idp-field">
                      <div className="idp-label-row">
                        <span className="idp-label">格式</span>
                      </div>
                      <Segmented
                        block
                        size="small"
                        className="idp-segmented"
                        aria-label="输出格式"
                        value={format}
                        options={[
                          { label: "JPG", value: "jpg" },
                          { label: "PNG", value: "png" },
                        ]}
                        onChange={(value) =>
                          setFormat(value as IdPhotoFormat)
                        }
                      />
                    </div>
                    {format === "jpg" && (
                      <div className="idp-field">
                        <div className="idp-label-row">
                          <span className="idp-label">质量</span>
                          <span className="idp-value">{quality}</span>
                        </div>
                        <Slider
                          min={60}
                          max={100}
                          aria-label="JPG 质量"
                          value={quality}
                          onChange={(value) => setQuality(value)}
                        />
                      </div>
                    )}
                    <p className="idp-note">
                      {ID_PHOTO_DPI} DPI · {pixels.width} × {pixels.height} px
                    </p>
                  </>
                ) : (
                  <p className="idp-note">
                    排版图固定为 PNG，按 6 寸相纸、{ID_PHOTO_DPI} DPI 导出，
                    {sheet.count} 张一版。
                  </p>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}

      <div
        className={`idp-drop-overlay${dragging ? " is-active" : ""}`}
        aria-hidden="true"
      >
        <ImagePlus size={22} strokeWidth={1.7} />
        松开以打开照片
      </div>
    </div>
  );
}