import { useCallback, useEffect, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  ColorPicker,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Slider,
  Spin,
  Switch,
  Tooltip,
} from "antd";
import {
  ArrowLeft,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  ImageOff,
  ImagePlus,
  Plus,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Undo2,
  X,
} from "lucide-react";
import HelpTip from "../components/HelpTip";
import { useToolBack } from "../hooks/useToolBack";
import {
  FORMAT_EXT,
  formatLabel,
  isHeic,
  isSupportedRaster,
  outputFilename,
  sourceFormatLabel,
} from "../image/io";
import {
  DEFAULT_EDIT_SETTINGS,
  editImage,
  type CropRatio,
  type EditResult,
  type EditSettings,
  type ResizeMode,
  type WatermarkPosition,
} from "../image/edit";
import { dedupeFilename, formatBytes } from "../compress/compress";
import { exportBatch } from "../compress/export";
import { saveExport } from "../seal/save";
import "../styles/studio.css";

interface SourceItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

type Job =
  | { status: "working" }
  | { status: "done"; result: EditResult; settingsKey: string }
  | { status: "error"; message: string; settingsKey: string };

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const fileKey = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`;

const POSITIONS: { value: WatermarkPosition; label: string }[] = [
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

const cropOptions = [
  { label: "原图比例", value: "original" },
  { label: "1:1", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
];

export default function ImageEditTool() {
  const goBack = useToolBack();
  const { message } = AntdApp.useApp();

  const [sources, setSources] = useState<SourceItem[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [settings, setSettings] = useState<EditSettings>(
    DEFAULT_EDIT_SETTINGS,
  );
  const [dragging, setDragging] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const sourcesRef = useRef<SourceItem[]>([]);
  const jobsRef = useRef<Record<string, Job>>({});
  const runRef = useRef(0);
  const dragDepth = useRef(0);

  const commitSources = useCallback((next: SourceItem[]) => {
    sourcesRef.current = next;
    setSources(next);
  }, []);

  const applyJobs = useCallback((next: Record<string, Job>) => {
    jobsRef.current = next;
    setJobs(next);
  }, []);

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;

      const supported = incoming.filter(isSupportedRaster);
      const heicCount = incoming.filter(isHeic).length;
      const unsupported = incoming.length - supported.length - heicCount;
      const existing = new Set(
        sourcesRef.current.map((item) => fileKey(item.file)),
      );
      const fresh: SourceItem[] = [];
      let duplicates = 0;

      for (const file of supported) {
        if (existing.has(fileKey(file))) {
          duplicates += 1;
          continue;
        }
        fresh.push({
          id: makeId(),
          file,
          name: file.name,
          size: file.size,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (fresh.length > 0) {
        commitSources([...sourcesRef.current, ...fresh]);
      }

      const notes: string[] = [];
      if (heicCount > 0) notes.push(`${heicCount} 个 HEIC 暂不支持`);
      if (unsupported > 0) notes.push(`${unsupported} 个格式不支持`);
      if (duplicates > 0) notes.push(`${duplicates} 张重复`);
      if (notes.length > 0) message.warning(`已跳过：${notes.join("，")}`);
    },
    [commitSources, message],
  );

  const removeSource = (id: string) => {
    const target = sourcesRef.current.find((item) => item.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    commitSources(sourcesRef.current.filter((item) => item.id !== id));
    const nextJobs = { ...jobsRef.current };
    delete nextJobs[id];
    applyJobs(nextJobs);
    setPreviewId((current) => (current === id ? null : current));
  };

  const clearAll = () => {
    for (const item of sourcesRef.current) {
      URL.revokeObjectURL(item.previewUrl);
    }
    commitSources([]);
    applyJobs({});
    setPreviewId(null);
  };

  const openPicker = () => inputRef.current?.click();

  useEffect(
    () => () => {
      for (const item of sourcesRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    },
    [],
  );

  useEffect(() => {
    if (sources.length === 0) {
      applyJobs({});
      return;
    }

    const settingsKey = JSON.stringify(settings);
    const targets = sources.filter((source) => {
      const job = jobsRef.current[source.id];
      if (!job || job.status === "working") return true;
      return job.settingsKey !== settingsKey;
    });
    if (targets.length === 0) return;

    const run = ++runRef.current;
    const isCurrent = () => runRef.current === run;

    const timer = window.setTimeout(() => {
      if (!isCurrent()) return;
      const next = { ...jobsRef.current };
      for (const source of targets) next[source.id] = { status: "working" };
      applyJobs(next);

      let cursor = 0;
      const worker = async () => {
        while (cursor < targets.length) {
          const source = targets[cursor];
          cursor += 1;
          if (!isCurrent()) return;
          try {
            const result = await editImage(source.file, settings, isCurrent);
            if (!isCurrent()) return;
            applyJobs({
              ...jobsRef.current,
              [source.id]: { status: "done", result, settingsKey },
            });
          } catch (error) {
            if (!isCurrent()) return;
            applyJobs({
              ...jobsRef.current,
              [source.id]: {
                status: "error",
                message:
                  error instanceof Error ? error.message : "处理失败",
                settingsKey,
              },
            });
          }
        }
      };
      void Promise.all(
        Array.from({ length: Math.min(2, targets.length) }, () => worker()),
      );
    }, 200);

    return () => {
      window.clearTimeout(timer);
      runRef.current += 1;
    };
  }, [sources, settings, applyJobs]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (previewId) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, [contenteditable='true'], .ant-select, .ant-popover, .ant-modal, .ant-color-picker",
        )
      ) {
        return;
      }
      if (
        document.querySelector(
          ".ant-popover:not(.ant-popover-hidden), .ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-modal-wrap, .ant-color-picker",
        )
      ) {
        return;
      }
      goBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goBack, previewId]);

  const previewSource = previewId
    ? (sources.find((item) => item.id === previewId) ?? null)
    : null;
  const previewJob = previewSource ? jobs[previewSource.id] : undefined;
  const previewResult = previewJob?.status === "done" ? previewJob.result : null;

  useEffect(() => {
    if (!previewResult) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewResult.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewResult]);

  const doneCount = sources.filter(
    (item) => jobs[item.id]?.status === "done",
  ).length;
  const errorCount = sources.filter(
    (item) => jobs[item.id]?.status === "error",
  ).length;
  const workingCount = sources.length - doneCount - errorCount;
  const settingsKey = JSON.stringify(settings);
  const stale = sources.some((item) => {
    const job = jobs[item.id];
    return !!job && job.status !== "working" && job.settingsKey !== settingsKey;
  });
  const settled = sources.length > 0 && workingCount === 0;
  const statsReady = settled && !stale;

  const originalTotal = sources.reduce((sum, item) => sum + item.size, 0);
  const outputTotal = sources.reduce((sum, item) => {
    const job = jobs[item.id];
    return job?.status === "done" ? sum + job.result.blob.size : sum;
  }, 0);

  const statusText = stale
    ? "正在更新…"
    : workingCount > 0
      ? `已完成 ${doneCount}/${sources.length}`
      : errorCount > 0
        ? `${errorCount} 张未能处理`
        : "全部完成";

  const exportAll = async () => {
    if (stale || workingCount > 0) return;
    const used = new Set<string>();
    const files = sources.flatMap((source) => {
      const job = jobs[source.id];
      if (job?.status !== "done") return [];
      return [
        {
          filename: dedupeFilename(
            outputFilename(source.name, "_处理", job.result.format),
            used,
          ),
          blob: job.result.blob,
        },
      ];
    });
    if (files.length === 0) return;

    setExporting(true);
    try {
      const result = await exportBatch(files);
      if (result.status === "saved") {
        const skipped = errorCount > 0 ? `，${errorCount} 张未导出` : "";
        message.success(
          result.path
            ? `已导出 ${result.count} 张图片${skipped}`
            : `已开始下载 ${result.count} 张图片${skipped}`,
        );
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const exportOne = async (source: SourceItem) => {
    const job = jobs[source.id];
    if (job?.status !== "done" || stale) return;
    setSavingId(source.id);
    try {
      const bytes = new Uint8Array(await job.result.blob.arrayBuffer());
      const result = await saveExport(
        bytes,
        outputFilename(source.name, "_处理", job.result.format),
        FORMAT_EXT[job.result.format],
      );
      if (result.status === "saved") message.success(`已导出：${result.path}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出失败");
    } finally {
      setSavingId(null);
    }
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
      addFiles(event.dataTransfer.files);
    }
  };

  const updateSettings = (patch: Partial<EditSettings>) =>
    setSettings((previous) => ({ ...previous, ...patch }));

  const updateWatermark = (
    patch: Partial<EditSettings["watermark"]>,
  ) =>
    setSettings((previous) => ({
      ...previous,
      watermark: { ...previous.watermark, ...patch },
    }));

  const rotateBy = (degrees: 90 | 270) =>
    setSettings((previous) => ({
      ...previous,
      rotate: ((previous.rotate + degrees) % 360) as EditSettings["rotate"],
    }));

  const resetEdits = () =>
    updateSettings({
      rotate: 0,
      flipH: false,
      flipV: false,
      cropRatio: "original",
      resizeMode: "none",
    });

  const previewMeta = (() => {
    if (!previewSource) return "";
    if (previewJob?.status === "done") {
      const result = previewJob.result;
      return `${sourceFormatLabel(result.sourceFormat)} → ${formatLabel(result.format)} · ${result.sourceWidth}×${result.sourceHeight} → ${result.width}×${result.height} · ${formatBytes(result.blob.size)}`;
    }
    return `${formatBytes(previewSource.size)}`;
  })();

  return (
    <div
      className="tool-page studio-page"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <h1 className="visually-hidden">图片处理</h1>

      <div className="studio-topbar">
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
        accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.avif,image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif"
        multiple
        tabIndex={-1}
        className="visually-hidden"
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {sources.length === 0 ? (
        <div className="studio-empty-wrap">
          <div className="studio-drop" onClick={openPicker}>
            <span className="studio-drop-icon" aria-hidden="true">
              <SlidersHorizontal size={26} strokeWidth={1.6} />
            </span>
            <h2>拖入图片开始处理</h2>
            <p>旋转、翻转、裁剪、缩放与加水印，同一组设置一次套用到所有图片。</p>
            <Button
              type="primary"
              size="large"
              icon={<ImagePlus size={16} strokeWidth={1.8} />}
              onClick={(event) => {
                event.stopPropagation();
                openPicker();
              }}
            >
              选择图片
            </Button>
          </div>
        </div>
      ) : (
        <div className="studio-workspace">
          <section className="studio-card" aria-label="待处理图片">
            <header className="studio-card-head">
              <div className="studio-card-title">
                <strong>{sources.length} 张图片</strong>
                <span>{formatBytes(originalTotal)}</span>
              </div>
              <div className="studio-card-actions">
                <Button
                  size="small"
                  icon={<Plus size={14} strokeWidth={1.8} />}
                  onClick={openPicker}
                >
                  添加图片
                </Button>
                <Popconfirm
                  title="清空全部图片？"
                  okText="清空"
                  cancelText="取消"
                  placement="bottomRight"
                  onConfirm={clearAll}
                >
                  <Button size="small" type="text">
                    清空
                  </Button>
                </Popconfirm>
              </div>
            </header>

            <div className="studio-rows">
              {sources.map((item) => {
                const job = jobs[item.id];
                const done = job?.status === "done" ? job.result : null;
                return (
                  <div className="studio-row" key={item.id}>
                    <button
                      type="button"
                      className="studio-row-open"
                      aria-label={`预览 ${item.name}`}
                      onClick={() => setPreviewId(item.id)}
                    >
                      <span className="studio-thumb" aria-hidden="true">
                        {job?.status === "error" ? (
                          <ImageOff size={16} strokeWidth={1.7} />
                        ) : (
                          <img
                            src={item.previewUrl}
                            alt=""
                            loading="lazy"
                            draggable={false}
                          />
                        )}
                      </span>
                      <span className="studio-row-text">
                        <span className="studio-name" title={item.name}>
                          {item.name}
                        </span>
                        <span
                          className={`studio-meta${job?.status === "error" ? " is-error" : ""}`}
                        >
                          {job?.status === "error" ? (
                            <>
                              <span>{formatBytes(item.size)}</span>
                              <span className="studio-sep">·</span>
                              <span>{job.message}</span>
                            </>
                          ) : !done ? (
                            <>
                              <span>{formatBytes(item.size)}</span>
                              <span className="studio-sep">·</span>
                              <span className="studio-busy">
                                <Spin size="small" />
                                处理中…
                              </span>
                            </>
                          ) : (
                            <>
                              <span>
                                {done.width}×{done.height}
                              </span>
                              <span className="studio-sep">·</span>
                              <span>
                                {formatBytes(item.size)}
                                <span className="studio-arrow">→</span>
                                {formatBytes(done.blob.size)}
                              </span>
                              <span className="studio-sep">·</span>
                              <span>{formatLabel(done.format)}</span>
                            </>
                          )}
                        </span>
                      </span>
                    </button>

                    <div className="studio-row-actions">
                      <Tooltip title="导出这张">
                        <Button
                          type="text"
                          size="small"
                          className="studio-icon-btn"
                          aria-label={`导出 ${item.name}`}
                          icon={<Download size={15} strokeWidth={1.8} />}
                          loading={savingId === item.id}
                          disabled={!done || stale}
                          onClick={() => void exportOne(item)}
                        />
                      </Tooltip>
                      <Tooltip title="移除">
                        <Button
                          type="text"
                          size="small"
                          className="studio-icon-btn"
                          aria-label={`移除 ${item.name}`}
                          icon={<X size={15} strokeWidth={1.8} />}
                          onClick={() => removeSource(item.id)}
                        />
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="studio-panel" aria-label="处理设置">
            <div className="studio-panel-head">
              <h2 className="studio-panel-title">处理设置</h2>
              <Button
                type="text"
                size="small"
                icon={<Undo2 size={14} strokeWidth={1.8} />}
                onClick={resetEdits}
              >
                重置
              </Button>
            </div>

            <section className="studio-section">
              <h3 className="studio-section-title">旋转与翻转</h3>
              <div className="studio-two-col">
                <Button
                  icon={<RotateCcw size={15} strokeWidth={1.8} />}
                  onClick={() => rotateBy(270)}
                >
                  左转 90°
                </Button>
                <Button
                  icon={<RotateCw size={15} strokeWidth={1.8} />}
                  onClick={() => rotateBy(90)}
                >
                  右转 90°
                </Button>
                <Button
                  type={settings.flipH ? "primary" : "default"}
                  icon={<FlipHorizontal2 size={15} strokeWidth={1.8} />}
                  onClick={() =>
                    setSettings((previous) => ({
                      ...previous,
                      flipH: !previous.flipH,
                    }))
                  }
                >
                  水平翻转
                </Button>
                <Button
                  type={settings.flipV ? "primary" : "default"}
                  icon={<FlipVertical2 size={15} strokeWidth={1.8} />}
                  onClick={() =>
                    setSettings((previous) => ({
                      ...previous,
                      flipV: !previous.flipV,
                    }))
                  }
                >
                  垂直翻转
                </Button>
              </div>
            </section>

            <section className="studio-section">
              <h3 className="studio-section-title">裁剪与尺寸</h3>
              <div className="studio-field">
                <span className="studio-label">
                  裁剪比例
                  <HelpTip text="按所选比例居中裁剪。" />
                </span>
                <Select
                  value={settings.cropRatio}
                  options={cropOptions}
                  onChange={(value) =>
                    updateSettings({ cropRatio: value as CropRatio })
                  }
                />
              </div>

              <div className="studio-field">
                <span className="studio-label">
                  缩放
                  <HelpTip text="只缩小不放大，避免损失清晰度。" />
                </span>
                <Segmented
                  block
                  className="studio-segmented"
                  value={settings.resizeMode}
                  options={[
                    { label: "原尺寸", value: "none" },
                    { label: "长边", value: "longest" },
                    { label: "按比例", value: "percent" },
                  ]}
                  onChange={(value) =>
                    updateSettings({ resizeMode: value as ResizeMode })
                  }
                />
                {settings.resizeMode === "longest" && (
                  <div className="studio-row-inline">
                    <InputNumber
                      value={settings.longest}
                      min={16}
                      max={20000}
                      precision={0}
                      controls={false}
                      suffix="px"
                      aria-label="长边像素"
                      onChange={(value) =>
                        updateSettings({
                          longest:
                            value && value > 0 ? Math.round(value) : null,
                        })
                      }
                    />
                  </div>
                )}
                {settings.resizeMode === "percent" && (
                  <div className="studio-row-inline">
                    <InputNumber
                      value={settings.percent}
                      min={5}
                      max={100}
                      precision={0}
                      controls={false}
                      suffix="%"
                      aria-label="缩放百分比"
                      onChange={(value) =>
                        updateSettings({
                          percent: value ?? 100,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </section>

            <section className="studio-section">
              <div className="studio-switch-row">
                <h3 className="studio-section-title">文字水印</h3>
                <Switch
                  size="small"
                  checked={settings.watermark.enabled}
                  onChange={(checked) => updateWatermark({ enabled: checked })}
                />
              </div>

              {settings.watermark.enabled && (
                <>
                  <Input
                    value={settings.watermark.text}
                    maxLength={60}
                    placeholder="输入水印文字"
                    aria-label="水印文字"
                    onChange={(event) =>
                      updateWatermark({ text: event.target.value })
                    }
                  />

                  <div className="studio-field">
                    <span className="studio-label">位置</span>
                    <div className="position-grid" role="group" aria-label="水印位置">
                      {POSITIONS.map((position) => (
                        <button
                          key={position.value}
                          type="button"
                          title={position.label}
                          aria-label={position.label}
                          aria-pressed={
                            settings.watermark.position === position.value
                          }
                          className={
                            settings.watermark.position === position.value
                              ? "is-active"
                              : undefined
                          }
                          onClick={() =>
                            updateWatermark({ position: position.value })
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="studio-field">
                    <div className="studio-label-row">
                      <span className="studio-label">字号</span>
                      <span className="studio-value">
                        {settings.watermark.sizePercent}% 宽
                      </span>
                    </div>
                    <Slider
                      min={1}
                      max={15}
                      value={settings.watermark.sizePercent}
                      onChange={(value) =>
                        updateWatermark({ sizePercent: value })
                      }
                    />
                  </div>

                  <div className="studio-field">
                    <div className="studio-label-row">
                      <span className="studio-label">不透明度</span>
                      <span className="studio-value">
                        {settings.watermark.opacity}%
                      </span>
                    </div>
                    <Slider
                      min={5}
                      max={100}
                      value={settings.watermark.opacity}
                      onChange={(value) =>
                        updateWatermark({ opacity: value })
                      }
                    />
                  </div>

                  <div className="studio-field">
                    <div className="studio-label-row">
                      <span className="studio-label">边距</span>
                      <span className="studio-value">
                        {settings.watermark.marginPercent}% 宽
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={20}
                      value={settings.watermark.marginPercent}
                      onChange={(value) =>
                        updateWatermark({ marginPercent: value })
                      }
                    />
                  </div>

                  <div className="studio-two-col">
                    <ColorPicker
                      value={settings.watermark.color}
                      disabledAlpha
                      showText
                      onChange={(color) =>
                        updateWatermark({
                          color: color.toHexString().slice(0, 7),
                        })
                      }
                    />
                    <div className="studio-switch-row">
                      <span className="studio-label">粗体</span>
                      <Switch
                        size="small"
                        checked={settings.watermark.bold}
                        onChange={(checked) =>
                          updateWatermark({ bold: checked })
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="studio-section">
              <h3 className="studio-section-title">
                输出
                <HelpTip text="自动保留原格式；JPG 会用白色填充透明区域。" />
              </h3>
              <Segmented
                block
                className="studio-segmented"
                value={settings.format}
                options={[
                  { label: "自动", value: "auto" },
                  { label: "JPG", value: "jpeg" },
                  { label: "PNG", value: "png" },
                  { label: "WebP", value: "webp" },
                ]}
                onChange={(value) =>
                  updateSettings({
                    format: value as EditSettings["format"],
                  })
                }
              />
              {settings.format !== "png" && (
                <div className="studio-field">
                  <div className="studio-label-row">
                    <span className="studio-label">质量</span>
                    <span className="studio-value">{settings.quality}</span>
                  </div>
                  <Slider
                    min={30}
                    max={100}
                    value={settings.quality}
                    onChange={(value) => updateSettings({ quality: value })}
                  />
                </div>
              )}
            </section>

            <section className="studio-result">
              <div className="studio-result-head">
                <span className="studio-result-title">处理结果</span>
                <span
                  className={`studio-status${errorCount > 0 ? " is-warn" : ""}`}
                  aria-live="polite"
                >
                  {statusText}
                </span>
              </div>

              <div className="studio-stats">
                <div className="studio-stat">
                  <span>原始</span>
                  <strong>{formatBytes(originalTotal)}</strong>
                </div>
                <div className="studio-stat">
                  <span>处理后</span>
                  <strong>
                    {statsReady && doneCount > 0
                      ? formatBytes(outputTotal)
                      : "—"}
                  </strong>
                </div>
                <div className="studio-stat">
                  <span>完成</span>
                  <strong>
                    {doneCount}/{sources.length}
                  </strong>
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                block
                className="studio-export"
                icon={<Download size={16} strokeWidth={1.8} />}
                loading={exporting}
                disabled={stale || workingCount > 0 || doneCount === 0}
                onClick={() => void exportAll()}
              >
                {errorCount > 0 ? `导出 ${doneCount} 张` : "导出全部"}
              </Button>
            </section>
          </aside>
        </div>
      )}

      <div
        className={`studio-drop-overlay${dragging ? " is-active" : ""}`}
        aria-hidden="true"
      >
        <ImagePlus size={22} strokeWidth={1.7} />
        松开以添加图片
      </div>

      <Modal
        open={previewSource !== null}
        onCancel={() => setPreviewId(null)}
        width={880}
        centered
        destroyOnHidden
        title={
          previewSource ? (
            <div className="studio-modal-title">
              <span className="studio-modal-name" title={previewSource.name}>
                {previewSource.name}
              </span>
              <span className="studio-modal-sub">{previewMeta}</span>
            </div>
          ) : null
        }
        footer={[
          <Button key="close" onClick={() => setPreviewId(null)}>
            关闭
          </Button>,
          <Button
            key="export"
            type="primary"
            icon={<Download size={16} strokeWidth={1.8} />}
            loading={previewSource ? savingId === previewSource.id : false}
            disabled={!previewResult || stale}
            onClick={() => {
              if (previewSource) void exportOne(previewSource);
            }}
          >
            导出这张
          </Button>,
        ]}
      >
        {previewSource && (
          <div className="studio-compare">
            <div className="studio-compare-pane">
              <div className="studio-compare-head">
                <span>原图</span>
                <span>{formatBytes(previewSource.size)}</span>
              </div>
              <figure>
                <img
                  src={previewSource.previewUrl}
                  alt={`原图 ${previewSource.name}`}
                  draggable={false}
                />
              </figure>
            </div>

            <div className="studio-compare-pane">
              <div className="studio-compare-head">
                <span>处理后</span>
                <span>
                  {previewResult
                    ? `${previewResult.width}×${previewResult.height} · ${formatBytes(previewResult.blob.size)}`
                    : previewJob?.status === "error"
                      ? "未能处理"
                      : "处理中"}
                </span>
              </div>
              <figure>
                {previewResult && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`处理后 ${previewSource.name}`}
                    draggable={false}
                  />
                ) : previewJob?.status === "error" ? (
                  <span className="studio-compare-state is-error">
                    {previewJob.message}
                  </span>
                ) : (
                  <span className="studio-compare-state">
                    <Spin size="small" />
                    正在处理…
                  </span>
                )}
              </figure>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}